const DEFAULT_URL = "https://ui.perfetto.dev";

function getDefaultUrls() {
  return [DEFAULT_URL];
}

async function getSupportedUrls() {
  const data = await chrome.storage.sync.get(['supportedUrls']);
  return data.supportedUrls || getDefaultUrls();
}

async function registerDynamicContentScripts(urls) {
  // Exclude the default URL — it's handled by static content_scripts in manifest.json
  const customUrls = urls.filter(url => {
    try { return new URL(url).origin !== new URL(DEFAULT_URL).origin; }
    catch(e) { return true; }
  });

  if (customUrls.length === 0) {
    await unregisterDynamicContentScripts();
    return;
  }

  const matches = customUrls.map(url => url.endsWith('/') ? `${url}*` : `${url}/*`);
  try {
    await chrome.scripting.registerContentScripts([{
      id: "perfetto-auto-pin-scripts",
      matches: matches,
      js: ["src/bridge.js"],
      css: ["src/content.css"],
      run_at: "document_idle"
    }]);
    console.log('[Perfetto Auto-Pin] Content scripts registered for:', matches);
  } catch (error) {
    console.error('[Perfetto Auto-Pin] Failed to register content scripts:', error);
  }
}

async function unregisterDynamicContentScripts() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ["perfetto-auto-pin-scripts"] });
  } catch (error) {
    // Ignore error if not registered
  }
}

// Inject scripts into already-open tabs matching custom URLs
async function injectIntoExistingTabs(urls) {
  const customUrls = urls.filter(url => {
    try { return new URL(url).origin !== new URL(DEFAULT_URL).origin; }
    catch(e) { return true; }
  });
  if (customUrls.length === 0) return;

  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url) continue;
      const tabOrigin = new URL(tab.url).origin;
      const isCustomMatch = customUrls.some(url => {
        try { return tabOrigin === new URL(url).origin; }
        catch(e) { return false; }
      });
      if (isCustomMatch) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/bridge.js"]
          });
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["src/content.css"]
          });
          console.log('[Perfetto Auto-Pin] Injected into existing tab:', tab.url);
        } catch (e) {
          // Tab might not be accessible, ignore
        }
      }
    }
  } catch (e) {
    console.error('[Perfetto Auto-Pin] Failed to inject into existing tabs:', e);
  }
}

async function refreshContentScripts() {
  await unregisterDynamicContentScripts();
  const urls = await getSupportedUrls();
  await registerDynamicContentScripts(urls);
  await injectIntoExistingTabs(urls);
}

async function isUrlSupported(url) {
  if (!url) return false;
  try {
    const urls = await getSupportedUrls();
    const urlObj = new URL(url);
    const origin = urlObj.origin;
    return urls.some(supportedUrl => {
      try {
        return origin === new URL(supportedUrl).origin;
      } catch (e) {
        return url.startsWith(supportedUrl);
      }
    });
  } catch (e) {
    return false;
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Perfetto Auto-Pin] Extension installed');
    await chrome.storage.sync.set({ supportedUrls: getDefaultUrls() });
  } else if (details.reason === 'update') {
    console.log('[Perfetto Auto-Pin] Extension updated');
  }
  await refreshContentScripts();
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshContentScripts();
});

// Listen for tab updates to enable/disable extension badge
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const supported = await isUrlSupported(tab.url);
    if (supported) {
      // Enable extension for Perfetto UI
      chrome.action.setBadgeText({ tabId, text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#34a853' });
    } else {
      // Disable for other pages
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }

  if (request.type === 'GET_SUPPORTED_URLS') {
    getSupportedUrls().then(urls => sendResponse({ urls }));
    return true;
  }

  if (request.type === 'ADD_SUPPORTED_URL') {
    (async () => {
      try {
        const url = request.url;
        const urls = await getSupportedUrls();
        if (!urls.includes(url)) {
          urls.push(url);
          await chrome.storage.sync.set({ supportedUrls: urls });
          await refreshContentScripts();
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error(error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.type === 'REMOVE_SUPPORTED_URL') {
    (async () => {
      try {
        const url = request.url;
        const urls = await getSupportedUrls();
        const newUrls = urls.filter(u => u !== url);
        await chrome.storage.sync.set({ supportedUrls: newUrls });
        await refreshContentScripts();
        
        try {
          const origin = new URL(url).origin + '/*';
          await chrome.permissions.remove({ origins: [origin] });
        } catch(e) { }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error(error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.type === 'INJECT_SCRIPTS_TO_TAB') {
    (async () => {
      try {
        const tabId = request.tabId;
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["src/bridge.js"]
        });
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ["src/content.css"]
        });
        console.log('[Perfetto Auto-Pin] Injected scripts into tab:', tabId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Perfetto Auto-Pin] Failed to inject into tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// Keyboard shortcut support
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) return;
  const supported = await isUrlSupported(tab.url);
  if (!supported) return;

  switch (command) {
    case 'quick-pin':
      // Open popup for quick pin
      chrome.action.openPopup();
      break;

    case 'apply-last-scene':
      // Apply last used scene
      const data = await chrome.storage.sync.get(['lastUsedScene']);
      if (data.lastUsedScene) {
        chrome.tabs.sendMessage(tab.id, {
          command: 'PIN_TRACKS',
          tracks: data.lastUsedScene.tracks
        });
      }
      break;
  }
});

console.log('[Perfetto Auto-Pin] Background service worker started');
