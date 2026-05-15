// Perfetto Auto-Pin Bridge Script
// This script runs in the ISOLATED world and bridges communication between
// the Chrome extension API and the content script running in the MAIN world

(function() {
  'use strict';

  // Prevent duplicate injection (can happen when dynamically injected via executeScript)
  if (window.__perfettoAutoPinBridgeLoaded) return;
  window.__perfettoAutoPinBridgeLoaded = true;

  const LOG_PREFIX = '[Perfetto Auto-Pin Bridge]';

  // Inject the main content script into the page's MAIN world
  function injectContentScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content.js');
    script.onload = function() {
      this.remove();
      console.log(`${LOG_PREFIX} Content script injected`);
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Handle messages from the popup via chrome.runtime
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`${LOG_PREFIX} Received message from popup:`, request.command);

    // Create a unique message ID for this request
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Set up a one-time listener for the response
    const responseHandler = (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'PERFETTO_AUTO_PIN_RESPONSE') return;
      if (event.data.messageId !== messageId) return;

      window.removeEventListener('message', responseHandler);
      console.log(`${LOG_PREFIX} Received response from content script:`, event.data);
      sendResponse(event.data.data);
    };

    window.addEventListener('message', responseHandler);

    // Forward the message to the content script in MAIN world
    window.postMessage({
      type: 'PERFETTO_AUTO_PIN_COMMAND',
      command: request.command,
      payload: request,
      messageId: messageId
    }, '*');

    // Set a timeout to clean up the listener if no response
    setTimeout(() => {
      window.removeEventListener('message', responseHandler);
    }, 10000);

    // Return true to indicate we will send a response asynchronously
    return true;
  });

  // Listen for messages from content script to forward to popup
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'PERFETTO_AUTO_PIN_EVENT') return;

    // Forward events to the background script if needed
    chrome.runtime.sendMessage(event.data);
  });

  // Inject the content script when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectContentScript);
  } else {
    injectContentScript();
  }

  console.log(`${LOG_PREFIX} Bridge script loaded`);
})();
