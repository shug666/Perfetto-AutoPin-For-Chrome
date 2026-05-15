// Perfetto Auto-Pin Popup Script

(function () {
  "use strict";

  // Default preset scenes for Android performance analysis
  const DEFAULT_PRESETS = [
    {
      id: "frame-analysis",
      name: "帧率分析",
      icon: "🎬",
      tracks: [
        "Choreographer#doFrame",
        "DrawFrame",
        "RenderThread",
        "GPU completion",
        "VSYNC-app",
        "VSYNC-sf",
        "main",
        "Actual Timeline",
        "Expected Timeline",
      ],
      description: "分析应用帧率和渲染性能",
    },
    {
      id: "startup-analysis",
      name: "启动分析",
      icon: "🚀",
      tracks: [
        "main",
        "bindApplication",
        "activityStart",
        "activityResume",
        "Binder:*",
        "ActivityManager",
        "ActivityTaskManager",
        "reportFullyDrawn",
      ],
      description: "分析应用启动性能",
    },
    {
      id: "input-analysis",
      name: "输入响应",
      icon: "👆",
      tracks: [
        "main",
        "InputDispatcher",
        "InputReader",
        "RenderThread",
        "deliverInputEvent",
        "dispatchTouchEvent",
        "TouchLatency",
      ],
      description: "分析触摸输入响应",
    },
    {
      id: "memory-analysis",
      name: "内存分析",
      icon: "💾",
      tracks: [
        "HeapTaskDaemon",
        "FinalizerDaemon",
        "GC*",
        "main",
        "mem.*",
        "RSS:*",
      ],
      description: "分析内存使用和GC",
    },
    {
      id: "binder-analysis",
      name: "Binder 调用",
      icon: "🔗",
      tracks: ["main", "Binder:*", "binder transaction", "binder reply"],
      description: "分析进程间通信",
    },
    {
      id: "sysui-analysis",
      name: "SystemUI 分析",
      icon: "📱",
      tracks: [
        "systemui",
        "Actual Timeline",
        "Expected Timeline",
        "IKeyguardService",
        "Transition:*",
        "UI Events",
        "main",
      ],
      description: "分析 SystemUI 性能",
    },
    {
      id: "surfaceflinger",
      name: "SurfaceFlinger",
      icon: "🖼️",
      tracks: [
        "surfaceflinger",
        "VSYNC-sf",
        "VSYNC-app",
        "GPU completion",
        "HWC release",
        "HW_VSYNC*",
      ],
      description: "分析 SurfaceFlinger 合成",
    },
    {
      id: "cpu-analysis",
      name: "CPU 调度",
      icon: "⚡",
      tracks: ["CPU *", "sched_*", "Runnable", "Running", "freq"],
      description: "分析 CPU 调度和频率",
    },
  ];

  // App State
  const state = {
    currentTab: null,
    tracks: [],
    selectedTracks: new Set(),
    customScenes: [],
    modifiedPresets: {}, // User-modified preset scenes
    settings: {
      fuzzyMatch: true,
      caseInsensitive: true,
      persistDuration: true,
    },
    editingScene: null,
    editingPresetId: null, // Track if editing a preset scene
    viewMode: "flat", // 'flat' or 'grouped'
    expandedGroups: new Set(),
    history: [], // Track pinning history for recommendations
    supportedUrls: ["https://ui.perfetto.dev"], // Supported Perfetto UI URLs
  };

  // DOM Elements
  const elements = {
    status: document.getElementById("status"),
    notPerfetto: document.getElementById("not-perfetto"),
    mainContent: document.getElementById("main-content"),
    tabs: document.querySelectorAll(".tab"),
    tabContents: document.querySelectorAll(".tab-content"),
    presetScenes: document.getElementById("preset-scenes"),
    customScenes: document.getElementById("custom-scenes"),
    addSceneBtn: document.getElementById("add-scene-btn"),
    trackSearch: document.getElementById("track-search"),
    refreshTracks: document.getElementById("refresh-tracks"),
    trackList: document.getElementById("track-list"),
    pinSelected: document.getElementById("pin-selected"),
    saveAsScene: document.getElementById("save-as-scene"),
    fuzzyMatch: document.getElementById("fuzzy-match"),
    caseInsensitive: document.getElementById("case-insensitive"),
    exportConfig: document.getElementById("export-config"),
    importConfig: document.getElementById("import-config"),
    importFile: document.getElementById("import-file"),
    sceneModal: document.getElementById("scene-modal"),
    modalTitle: document.getElementById("modal-title"),
    sceneName: document.getElementById("scene-name"),
    sceneTracks: document.getElementById("scene-tracks"),
    sceneIcon: document.getElementById("scene-icon"),
    modalCancel: document.getElementById("modal-cancel"),
    modalSave: document.getElementById("modal-save"),
    modalClose: document.querySelector(".modal-close"),
    // New elements for Phase 2
    viewFlat: document.getElementById("view-flat"),
    viewGrouped: document.getElementById("view-grouped"),
    selectAll: document.getElementById("select-all"),
    selectNone: document.getElementById("select-none"),
    selectionCount: document.getElementById("selection-count"),
    // New elements for Phase 3
    historySection: document.getElementById("history-section"),
    recentHistory: document.getElementById("recent-history"),
    // New elements for preset editing and unpin
    unpinAllGlobal: document.getElementById("unpin-all-global"),
    modalRestoreDefault: document.getElementById("modal-restore-default"),
    // Duration overlay toggle
    persistDuration: document.getElementById("persist-duration"),
    // URL Management
    supportedUrlsList: document.getElementById("supported-urls-list"),
    addUrlBtn: document.getElementById("add-url-btn"),
    newUrlInput: document.getElementById("new-url-input"),
  };

  // Maximum history entries to keep
  const MAX_HISTORY_ENTRIES = 5;

  // Initialize
  async function init() {
    await loadSettings();
    await checkPerfettoTab();
    setupEventListeners();
    setupKeyboardShortcuts();
    renderPresetScenes();
    renderCustomScenes();
    renderHistory();
    renderSupportedUrls();
  }

  // Add to history
  function addToHistory(scene) {
    // Create a history entry (deep copy tracks to avoid mutating the original scene)
    const entry = {
      id: `history-${Date.now()}`,
      name: scene.name,
      icon: scene.icon || "📌",
      tracks: [...scene.tracks],
      timestamp: Date.now(),
    };

    // Remove duplicates (same tracks) — use spread copies so .sort() doesn't mutate originals
    state.history = state.history.filter(
      (h) =>
        JSON.stringify([...h.tracks].sort()) !==
        JSON.stringify([...entry.tracks].sort()),
    );

    // Add to beginning
    state.history.unshift(entry);

    // Limit history size
    if (state.history.length > MAX_HISTORY_ENTRIES) {
      state.history = state.history.slice(0, MAX_HISTORY_ENTRIES);
    }

    saveSettings();
    renderHistory();
  }

  // Render history
  function renderHistory() {
    if (!elements.historySection || !elements.recentHistory) return;

    if (state.history.length === 0) {
      elements.historySection.classList.add("hidden");
      return;
    }

    elements.historySection.classList.remove("hidden");

    elements.recentHistory.innerHTML = state.history
      .map(
        (entry) => `
      <div class="scene-item history-item" data-history-id="${entry.id}">
        <div class="scene-icon">${entry.icon}</div>
        <div class="scene-info">
          <div class="scene-name">${escapeHtml(entry.name)}</div>
          <div class="scene-tracks-count">${entry.tracks.length} 个泳道 · ${formatTime(entry.timestamp)}</div>
        </div>
        <div class="scene-actions">
          <button class="scene-action-btn" data-action="apply" title="应用">▶️</button>
          <button class="scene-action-btn" data-action="delete" title="删除">🗑️</button>
        </div>
      </div>
    `,
      )
      .join("");

    // Add click handlers
    elements.recentHistory.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        const historyId = item.dataset.historyId;
        const entry = state.history.find((h) => h.id === historyId);

        if (action === "apply" || !action) {
          applyScene(entry);
        } else if (action === "delete") {
          deleteHistory(historyId);
        }
      });
    });
  }

  // Delete history entry
  function deleteHistory(historyId) {
    state.history = state.history.filter((h) => h.id !== historyId);
    saveSettings();
    renderHistory();
    showToast("已删除历史记录", "success");
  }

  // Format timestamp
  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  }

  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + Enter: Pin selected tracks
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (state.selectedTracks.size > 0) {
          pinSelectedTracks();
        }
      }

      // Ctrl/Cmd + A: Select all (when in tracks tab)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const tracksTab = document.getElementById("tracks-tab");
        if (tracksTab && tracksTab.classList.contains("active")) {
          e.preventDefault();
          selectAllTracks();
        }
      }

      // Escape: Close modal
      if (e.key === "Escape") {
        if (!elements.sceneModal.classList.contains("hidden")) {
          hideSceneModal();
        }
      }

      // Number keys 1-9: Quick apply preset scenes
      if (
        e.key >= "1" &&
        e.key <= "9" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const sceneIndex = parseInt(e.key) - 1;
        if (sceneIndex < DEFAULT_PRESETS.length) {
          const activeElement = document.activeElement;
          // Don't trigger if typing in an input
          if (
            activeElement.tagName !== "INPUT" &&
            activeElement.tagName !== "TEXTAREA"
          ) {
            applyScene(DEFAULT_PRESETS[sceneIndex]);
          }
        }
      }
    });
  }

  // Check if URL is supported
  function isUrlSupported(url) {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      return state.supportedUrls.some(supportedUrl => {
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

  // Check if current tab is Perfetto
  async function checkPerfettoTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      state.currentTab = tab;

      if (tab.url && isUrlSupported(tab.url)) {
        // Verify content script is ready
        let response = await sendMessage({ command: "PING" });

        // If PING failed, try to inject scripts into the tab and retry
        if (!response || response.status !== "ok") {
          console.log("[Perfetto Auto-Pin] PING failed, attempting to inject scripts...");
          try {
            await chrome.runtime.sendMessage({
              type: 'INJECT_SCRIPTS_TO_TAB',
              tabId: tab.id
            });
            // Wait for scripts to initialize (bridge.js needs to inject content.js)
            await new Promise(r => setTimeout(r, 1000));
            response = await sendMessage({ command: "PING" });
          } catch (e) {
            console.error("[Perfetto Auto-Pin] Script injection failed:", e);
          }
        }

        if (response && response.status === "ok") {
          setStatus("ready", "已连接");
          elements.notPerfetto.classList.add("hidden");
          elements.mainContent.classList.remove("hidden");
          await loadTracks();
          // Sync duration overlay state
          await sendMessage({
            command: "TOGGLE_DURATION_OVERLAY",
            enabled: state.settings.persistDuration !== false,
          });
        } else {
          setStatus("checking", "等待加载...");
          elements.notPerfetto.classList.add("hidden");
          elements.mainContent.classList.remove("hidden");
          // Retry after a short delay
          setTimeout(async () => {
            await loadTracks();
            setStatus("ready", "已连接");
          }, 1000);
        }
      } else {
        setStatus("error", "未检测到");
        elements.notPerfetto.classList.remove("hidden");
        elements.mainContent.classList.add("hidden");
      }
    } catch (error) {
      console.error("Error checking tab:", error);
      setStatus("error", "连接失败");
    }
  }

  // Set status indicator
  function setStatus(type, text) {
    elements.status.className = `status status-${type}`;
    elements.status.textContent = text;
  }

  // Send message to content script
  async function sendMessage(message) {
    try {
      const response = await chrome.tabs.sendMessage(
        state.currentTab.id,
        message,
      );
      return response;
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  }

  // Load tracks from content script
  async function loadTracks() {
    elements.trackList.innerHTML = '<p class="loading">正在加载泳道列表...</p>';

    const response = await sendMessage({ command: "GET_TRACKS" });

    if (response && response.tracks) {
      state.tracks = response.tracks;

      // Auto-select pinned tracks so they appear checked by default
      state.selectedTracks.clear();
      for (const track of response.tracks) {
        if (track.pinned) {
          state.selectedTracks.add(track.name);
        }
      }

      renderTrackList(state.tracks);
      updatePinButtonState();
    } else {
      elements.trackList.innerHTML =
        '<p class="empty-state">未找到泳道，请确保已打开 trace 文件</p>';
    }
  }

  // Filter tracks based on search term (supports wildcards)
  function filterTracks(tracks, searchTerm) {
    if (!searchTerm) return tracks;

    const term = searchTerm.toLowerCase();

    // Check if it's a wildcard pattern
    if (searchTerm.includes("*")) {
      const regexPattern = searchTerm
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      const regex = new RegExp(regexPattern, "i");
      return tracks.filter((track) => regex.test(track.name));
    }

    // Standard contains search
    return tracks.filter((track) => track.name.toLowerCase().includes(term));
  }

  // Group tracks by process/parent
  function groupTracks(tracks) {
    const groups = new Map();

    for (const track of tracks) {
      // Try to extract group name from track name
      let groupName = "Other";

      // Common patterns for grouping
      if (track.name.includes("/")) {
        groupName = track.name.split("/")[0];
      } else if (track.uri && track.uri.includes("/process_")) {
        const match = track.uri.match(/\/process_(\d+)/);
        if (match) {
          groupName = `Process ${match[1]}`;
        }
      } else if (track.name.match(/^(com\.|android\.|org\.)/)) {
        groupName = track.name.split(".").slice(0, 3).join(".");
      } else if (track.name.includes(":")) {
        groupName = track.name.split(":")[0];
      }

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName).push(track);
    }

    // Sort groups by name and tracks within groups
    const sortedGroups = new Map([...groups.entries()].sort());
    for (const [key, value] of sortedGroups) {
      value.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedGroups;
  }

  // Render track list
  function renderTrackList(tracks) {
    if (!tracks || tracks.length === 0) {
      elements.trackList.innerHTML = '<p class="empty-state">未找到泳道</p>';
      updateSelectionCount();
      return;
    }

    const searchTerm = elements.trackSearch.value;
    const filteredTracks = filterTracks(tracks, searchTerm);

    if (filteredTracks.length === 0) {
      elements.trackList.innerHTML =
        '<p class="empty-state">没有匹配的泳道</p>';
      updateSelectionCount();
      return;
    }

    if (state.viewMode === "grouped") {
      renderGroupedTrackList(filteredTracks);
    } else {
      renderFlatTrackList(filteredTracks);
    }

    updateSelectionCount();
  }

  // Render flat track list
  function renderFlatTrackList(tracks) {
    elements.trackList.innerHTML = tracks
      .map(
        (track) => `
      <div class="track-item ${state.selectedTracks.has(track.name) ? "selected" : ""} ${track.pinned ? "pinned" : ""}"
           data-track="${escapeHtml(track.name)}">
        <input type="checkbox" class="track-checkbox"
               ${state.selectedTracks.has(track.name) ? "checked" : ""} />
        <span class="track-name">${escapeHtml(track.name)}</span>
        ${track.pinned ? '<span class="track-status">已Pin</span>' : ""}
      </div>
    `,
      )
      .join("");

    attachTrackItemHandlers();
  }

  // Render grouped track list
  function renderGroupedTrackList(tracks) {
    const groups = groupTracks(tracks);

    elements.trackList.innerHTML = Array.from(groups.entries())
      .map(([groupName, groupTracks]) => {
        const isExpanded = state.expandedGroups.has(groupName);
        const selectedInGroup = groupTracks.filter((t) =>
          state.selectedTracks.has(t.name),
        ).length;
        const allSelected = selectedInGroup === groupTracks.length;
        const someSelected = selectedInGroup > 0 && !allSelected;

        return `
        <div class="track-group" data-group="${escapeHtml(groupName)}">
          <div class="track-group-header">
            <span class="track-group-toggle ${isExpanded ? "" : "collapsed"}">▼</span>
            <input type="checkbox" class="track-group-checkbox"
                   ${allSelected ? "checked" : ""}
                   ${someSelected ? "indeterminate" : ""} />
            <span class="track-group-name">${escapeHtml(groupName)}</span>
            <span class="track-group-count">${groupTracks.length}</span>
          </div>
          <div class="track-group-content ${isExpanded ? "" : "hidden"}">
            ${groupTracks
              .map(
                (track) => `
              <div class="track-item ${state.selectedTracks.has(track.name) ? "selected" : ""} ${track.pinned ? "pinned" : ""}"
                   data-track="${escapeHtml(track.name)}">
                <input type="checkbox" class="track-checkbox"
                       ${state.selectedTracks.has(track.name) ? "checked" : ""} />
                <span class="track-name">${escapeHtml(track.name)}</span>
                ${track.pinned ? '<span class="track-status">已Pin</span>' : ""}
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");

    attachTrackItemHandlers();
    attachGroupHandlers();
  }

  // Attach event handlers to track items
  function attachTrackItemHandlers() {
    elements.trackList.querySelectorAll(".track-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("track-checkbox")) return;
        const checkbox = item.querySelector(".track-checkbox");
        checkbox.checked = !checkbox.checked;
        toggleTrackSelection(item.dataset.track, checkbox.checked);
      });

      item.querySelector(".track-checkbox").addEventListener("change", (e) => {
        toggleTrackSelection(item.dataset.track, e.target.checked);
      });
    });
  }

  // Attach event handlers to group headers
  function attachGroupHandlers() {
    elements.trackList.querySelectorAll(".track-group").forEach((group) => {
      const header = group.querySelector(".track-group-header");
      const toggle = header.querySelector(".track-group-toggle");
      const checkbox = header.querySelector(".track-group-checkbox");
      const content = group.querySelector(".track-group-content");
      const groupName = group.dataset.group;

      // Toggle group expansion
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isExpanded = !toggle.classList.contains("collapsed");
        toggle.classList.toggle("collapsed", isExpanded);
        content.classList.toggle("hidden", isExpanded);
        if (isExpanded) {
          state.expandedGroups.delete(groupName);
        } else {
          state.expandedGroups.add(groupName);
        }
      });

      // Select/deselect all tracks in group
      checkbox.addEventListener("change", (e) => {
        const trackItems = content.querySelectorAll(".track-item");
        trackItems.forEach((item) => {
          const trackName = item.dataset.track;
          const itemCheckbox = item.querySelector(".track-checkbox");
          itemCheckbox.checked = e.target.checked;
          toggleTrackSelection(trackName, e.target.checked, false);
        });
        updateSelectionCount();
        updatePinButtonState();
      });

      // Click on header (except toggle and checkbox) expands the group
      header.addEventListener("click", (e) => {
        if (e.target === toggle || e.target === checkbox) return;
        toggle.click();
      });
    });
  }

  // Update selection count display
  function updateSelectionCount() {
    if (elements.selectionCount) {
      elements.selectionCount.textContent = `已选: ${state.selectedTracks.size}`;
    }
  }

  // Toggle track selection
  function toggleTrackSelection(trackName, selected, updateUI = true) {
    if (selected) {
      state.selectedTracks.add(trackName);
    } else {
      state.selectedTracks.delete(trackName);
    }

    if (updateUI) {
      const trackItem = elements.trackList.querySelector(
        `[data-track="${CSS.escape(trackName)}"]`,
      );
      if (trackItem) {
        trackItem.classList.toggle("selected", selected);
      }

      updatePinButtonState();
      updateSelectionCount();
    }
  }

  // Select all visible tracks
  function selectAllTracks() {
    const searchTerm = elements.trackSearch.value;
    const filteredTracks = filterTracks(state.tracks, searchTerm);

    filteredTracks.forEach((track) => {
      state.selectedTracks.add(track.name);
    });

    renderTrackList(state.tracks);
    updatePinButtonState();
  }

  // Deselect all tracks
  function selectNoneTracks() {
    state.selectedTracks.clear();
    renderTrackList(state.tracks);
    updatePinButtonState();
  }

  // Switch view mode
  function switchViewMode(mode) {
    state.viewMode = mode;
    elements.viewFlat.classList.toggle("active", mode === "flat");
    elements.viewGrouped.classList.toggle("active", mode === "grouped");
    renderTrackList(state.tracks);
  }

  // Update pin button state
  function updatePinButtonState() {
    elements.pinSelected.disabled = state.selectedTracks.size === 0;
  }

  // Render preset scenes
  // Get effective preset scene (with user modifications if any)
  function getEffectivePreset(presetId) {
    const defaultPreset = DEFAULT_PRESETS.find((s) => s.id === presetId);
    if (!defaultPreset) return null;

    const modified = state.modifiedPresets[presetId];
    if (modified) {
      return {
        ...defaultPreset,
        tracks: modified.tracks || defaultPreset.tracks,
        icon: modified.icon || defaultPreset.icon,
        _isModified: true,
      };
    }
    return { ...defaultPreset, _isModified: false };
  }

  // Check if preset is modified
  function isPresetModified(presetId) {
    return !!state.modifiedPresets[presetId];
  }

  function renderPresetScenes() {
    elements.presetScenes.innerHTML = DEFAULT_PRESETS.map((defaultScene) => {
      const scene = getEffectivePreset(defaultScene.id);
      const isModified = isPresetModified(defaultScene.id);
      return `
      <div class="scene-item" data-scene-id="${scene.id}" data-preset="true">
        <div class="scene-icon">${scene.icon}</div>
        <div class="scene-info">
          <div class="scene-name">
            ${escapeHtml(scene.name)}
            ${isModified ? '<span class="scene-modified">(已修改)</span>' : ""}
          </div>
          <div class="scene-tracks-count">${scene.tracks.length} 个泳道</div>
        </div>
        <div class="scene-actions">
          <button class="scene-action-btn" data-action="apply" title="应用">▶️</button>
          <button class="scene-action-btn" data-action="edit" title="编辑">✏️</button>
          <button class="scene-action-btn" data-action="unpin" title="Unpin 全部">🔓</button>
        </div>
      </div>
    `;
    }).join("");

    // Add click handlers
    elements.presetScenes.querySelectorAll(".scene-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        const sceneId = item.dataset.sceneId;
        const scene = getEffectivePreset(sceneId);

        if (action === "apply") {
          applyScene(scene);
        } else if (action === "edit") {
          editPresetScene(sceneId);
        } else if (action === "unpin") {
          unpinAllTracks();
        } else if (!action) {
          applyScene(scene);
        }
      });
    });
  }

  // Render custom scenes
  function renderCustomScenes() {
    if (state.customScenes.length === 0) {
      elements.customScenes.innerHTML =
        '<p class="empty-state text-muted">暂无自定义场景</p>';
      return;
    }

    elements.customScenes.innerHTML = state.customScenes
      .map(
        (scene) => `
      <div class="scene-item" data-scene-id="${scene.id}">
        <div class="scene-icon">${scene.icon || "📋"}</div>
        <div class="scene-info">
          <div class="scene-name">${escapeHtml(scene.name)}</div>
          <div class="scene-tracks-count">${scene.tracks.length} 个泳道</div>
        </div>
        <div class="scene-actions">
          <button class="scene-action-btn" data-action="apply" title="应用">▶️</button>
          <button class="scene-action-btn" data-action="edit" title="编辑">✏️</button>
          <button class="scene-action-btn" data-action="unpin" title="Unpin 全部">🔓</button>
          <button class="scene-action-btn" data-action="delete" title="删除">🗑️</button>
        </div>
      </div>
    `,
      )
      .join("");

    // Add click handlers
    elements.customScenes.querySelectorAll(".scene-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        const sceneId = item.dataset.sceneId;
        const scene = state.customScenes.find((s) => s.id === sceneId);

        if (action === "apply") {
          applyScene(scene);
        } else if (action === "edit") {
          editScene(scene);
        } else if (action === "unpin") {
          unpinAllTracks();
        } else if (action === "delete") {
          deleteScene(sceneId);
        } else if (!action) {
          applyScene(scene);
        }
      });
    });
  }

  // Apply scene (pin tracks)
  async function applyScene(scene) {
    if (!scene || !scene.tracks) return;

    showToast(`正在应用场景: ${scene.name}...`);

    const response = await sendMessage({
      command: "PIN_TRACKS",
      tracks: scene.tracks,
    });

    if (response) {
      const { success, notFound, alreadyPinned } = response;

      let message = "";
      if (success.length > 0) {
        message += `✅ 已 Pin ${success.length} 个泳道`;
        // Add to history on successful pin
        addToHistory(scene);
      }
      if (notFound.length > 0) {
        message += `\n⚠️ ${notFound.length} 个泳道未找到`;
      }
      if (alreadyPinned.length > 0) {
        message += `\nℹ️ ${alreadyPinned.length} 个泳道已经 Pin`;
      }

      showToast(message, success.length > 0 ? "success" : "warning");
      await loadTracks();
    } else {
      showToast("应用场景失败", "error");
    }
  }

  // Pin selected tracks
  async function pinSelectedTracks() {
    const tracks = Array.from(state.selectedTracks);
    if (tracks.length === 0) return;

    showToast(`正在 Pin ${tracks.length} 个泳道...`);

    const response = await sendMessage({
      command: "PIN_TRACKS",
      tracks: tracks,
    });

    if (response) {
      showToast(`已 Pin ${response.success.length} 个泳道`, "success");
      state.selectedTracks.clear();
      await loadTracks();
    } else {
      showToast("Pin 失败", "error");
    }
  }

  // Show scene editor modal
  function showSceneModal(scene = null, presetId = null) {
    state.editingScene = scene;
    state.editingPresetId = presetId;

    // Show/hide restore default button
    if (presetId && isPresetModified(presetId)) {
      elements.modalRestoreDefault.classList.remove("hidden");
    } else {
      elements.modalRestoreDefault.classList.add("hidden");
    }

    if (scene) {
      elements.modalTitle.textContent = presetId ? "编辑预设场景" : "编辑场景";
      elements.sceneName.value = scene.name;
      elements.sceneTracks.value = scene.tracks.join("\n");
      elements.sceneIcon.value = scene.icon || "";
      // Disable name editing for preset scenes
      elements.sceneName.disabled = !!presetId;
    } else {
      elements.modalTitle.textContent = "添加场景";
      elements.sceneName.value = "";
      elements.sceneTracks.value = Array.from(state.selectedTracks).join("\n");
      elements.sceneIcon.value = "";
      elements.sceneName.disabled = false;
    }

    elements.sceneModal.classList.remove("hidden");
  }

  // Hide scene modal
  function hideSceneModal() {
    elements.sceneModal.classList.add("hidden");
    state.editingScene = null;
    state.editingPresetId = null;
    elements.sceneName.disabled = false;
  }

  // Edit preset scene
  function editPresetScene(presetId) {
    const scene = getEffectivePreset(presetId);
    if (scene) {
      showSceneModal(scene, presetId);
    }
  }

  // Restore preset to default
  async function restorePresetDefault() {
    if (!state.editingPresetId) return;

    delete state.modifiedPresets[state.editingPresetId];
    await saveSettings();
    renderPresetScenes();
    hideSceneModal();
    showToast("已恢复默认设置", "success");
  }

  // Unpin all tracks
  async function unpinAllTracks() {
    showToast("正在清除所有 Pin...", "info");

    const response = await sendMessage({ command: "UNPIN_ALL" });

    if (response && response.success) {
      showToast("已清除所有 Pin", "success");
      await loadTracks();
    } else {
      showToast("清除失败", "error");
    }
  }

  // Save scene
  async function saveScene() {
    const name = elements.sceneName.value.trim();
    const tracks = elements.sceneTracks.value
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const icon = elements.sceneIcon.value.trim() || "📋";

    // For preset scenes, name is not editable
    if (!state.editingPresetId && !name) {
      showToast("请输入场景名称", "error");
      return;
    }

    if (tracks.length === 0) {
      showToast("请添加至少一个泳道", "error");
      return;
    }

    if (state.editingPresetId) {
      // Editing a preset scene - save to modifiedPresets
      state.modifiedPresets[state.editingPresetId] = {
        tracks,
        icon,
      };
      await saveSettings();
      renderPresetScenes();
    } else if (state.editingScene) {
      // Update existing custom scene
      const index = state.customScenes.findIndex(
        (s) => s.id === state.editingScene.id,
      );
      if (index !== -1) {
        state.customScenes[index] = {
          ...state.editingScene,
          name,
          tracks,
          icon,
        };
      }
      await saveSettings();
      renderCustomScenes();
    } else {
      // Create new custom scene
      state.customScenes.push({
        id: `custom-${Date.now()}`,
        name,
        tracks,
        icon,
      });
      await saveSettings();
      renderCustomScenes();
    }
    hideSceneModal();
    showToast("场景已保存", "success");
  }

  // Edit scene
  function editScene(scene) {
    showSceneModal(scene);
  }

  // Delete scene
  async function deleteScene(sceneId) {
    state.customScenes = state.customScenes.filter((s) => s.id !== sceneId);
    await saveSettings();
    renderCustomScenes();
    showToast("场景已删除", "success");
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const data = await chrome.storage.sync.get([
        "customScenes",
        "settings",
        "history",
        "modifiedPresets",
        "supportedUrls",
      ]);
      if (data.customScenes) {
        state.customScenes = data.customScenes;
      }
      if (data.settings) {
        state.settings = { ...state.settings, ...data.settings };
        elements.fuzzyMatch.checked = state.settings.fuzzyMatch;
        elements.caseInsensitive.checked = state.settings.caseInsensitive;
        if (elements.persistDuration) {
          elements.persistDuration.checked = state.settings.persistDuration !== false;
        }
      }
      if (data.history) {
        state.history = data.history;
      }
      if (data.modifiedPresets) {
        state.modifiedPresets = data.modifiedPresets;
      }
      if (data.supportedUrls) {
        state.supportedUrls = data.supportedUrls;
      } else {
        state.supportedUrls = ["https://ui.perfetto.dev"];
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  // Save settings to storage
  async function saveSettings() {
    try {
      await chrome.storage.sync.set({
        customScenes: state.customScenes,
        settings: state.settings,
        history: state.history,
        modifiedPresets: state.modifiedPresets,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  // Export config
  function exportConfig() {
    const config = {
      version: "1.0.0",
      customScenes: state.customScenes,
      modifiedPresets: state.modifiedPresets,
      settings: state.settings,
      history: state.history,
      supportedUrls: state.supportedUrls,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perfetto-auto-pin-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("配置已导出", "success");
  }

  // Import config
  function importConfig(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const config = JSON.parse(e.target.result);

        if (config.customScenes) {
          state.customScenes = config.customScenes;
        }
        if (config.modifiedPresets) {
          state.modifiedPresets = config.modifiedPresets;
        }
        if (config.settings) {
          state.settings = { ...state.settings, ...config.settings };
          elements.fuzzyMatch.checked = state.settings.fuzzyMatch;
          elements.caseInsensitive.checked = state.settings.caseInsensitive;
        }
        if (config.history) {
          state.history = config.history;
        }
        if (config.supportedUrls) {
          state.supportedUrls = config.supportedUrls;
        }

        await saveSettings();

        // If URLs were imported, save them directly and notify background to refresh
        if (config.supportedUrls) {
          await chrome.storage.sync.set({ supportedUrls: state.supportedUrls });
          // Background will pick up the new URLs on next refreshContentScripts call
          // Trigger a refresh by sending a no-op add for an existing URL
          chrome.runtime.sendMessage({ type: 'GET_SUPPORTED_URLS' });
        }

        renderPresetScenes();
        renderCustomScenes();
        renderHistory();
        renderSupportedUrls();
        showToast("配置已导入", "success");
      } catch (error) {
        console.error("Error importing config:", error);
        showToast("导入失败：无效的配置文件", "error");
      }
    };
    reader.readAsText(file);
  }

  // URL Management functions
  function renderSupportedUrls() {
    if (!elements.supportedUrlsList) return;
    
    elements.supportedUrlsList.innerHTML = state.supportedUrls.map(url => {
      const isDefault = url === "https://ui.perfetto.dev";
      return `
        <div class="url-item">
          <span class="url-text">${escapeHtml(url)}</span>
          ${isDefault ? '<span class="badge default-badge">默认</span>' : 
            `<button class="btn btn-icon remove-url-btn" data-url="${escapeHtml(url)}" title="删除">🗑️</button>`}
        </div>
      `;
    }).join('');

    elements.supportedUrlsList.querySelectorAll('.remove-url-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeSupportedUrl(btn.dataset.url);
      });
    });
  }

  function addSupportedUrl() {
    if (!elements.newUrlInput) return;
    let url = elements.newUrlInput.value.trim();
    
    if (!url) return;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast("网址必须以 http:// 或 https:// 开头", "error");
      return;
    }

    try {
      const urlObj = new URL(url);
      url = urlObj.origin;
    } catch (e) {
      showToast("无效的网址格式", "error");
      return;
    }

    if (state.supportedUrls.includes(url)) {
      showToast("该网址已存在", "warning");
      return;
    }

    const permissionUrl = url + "/*";
    chrome.permissions.request({ origins: [permissionUrl] }, async (granted) => {
      if (granted) {
        chrome.runtime.sendMessage({ type: 'ADD_SUPPORTED_URL', url: url }, async (response) => {
          if (response && response.success) {
            state.supportedUrls.push(url);
            renderSupportedUrls();
            elements.newUrlInput.value = '';
            showToast("网址已添加", "success");
            await checkPerfettoTab();
          } else {
            showToast("添加失败: " + (response?.error || '未知错误'), "error");
          }
        });
      } else {
        showToast("需要授权才能添加新网址", "error");
      }
    });
  }

  function removeSupportedUrl(url) {
    chrome.runtime.sendMessage({ type: 'REMOVE_SUPPORTED_URL', url: url }, async (response) => {
      if (response && response.success) {
        state.supportedUrls = state.supportedUrls.filter(u => u !== url);
        renderSupportedUrls();
        showToast("网址已删除", "success");
        await checkPerfettoTab();
      } else {
        showToast("删除失败: " + (response?.error || '未知错误'), "error");
      }
    });
  }

  // Show toast notification
  function showToast(message, type = "info") {
    // Remove existing toasts
    document.querySelectorAll(".toast").forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Tab switching
    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabId = tab.dataset.tab;

        elements.tabs.forEach((t) => t.classList.remove("active"));
        elements.tabContents.forEach((c) => c.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(`${tabId}-tab`).classList.add("active");

        // Load tracks when switching to tracks tab
        if (tabId === "tracks" && state.tracks.length === 0) {
          loadTracks();
        }
      });
    });

    // Track search
    elements.trackSearch.addEventListener("input", () => {
      renderTrackList(state.tracks);
    });

    // Refresh tracks
    elements.refreshTracks.addEventListener("click", loadTracks);

    // Pin selected
    elements.pinSelected.addEventListener("click", pinSelectedTracks);

    // Save as scene
    elements.saveAsScene.addEventListener("click", () => {
      if (state.selectedTracks.size === 0) {
        showToast("请先选择要保存的泳道", "error");
        return;
      }
      showSceneModal();
    });

    // Add scene button
    elements.addSceneBtn.addEventListener("click", () => showSceneModal());

    // Modal handlers
    elements.modalCancel.addEventListener("click", hideSceneModal);
    elements.modalClose.addEventListener("click", hideSceneModal);
    elements.modalSave.addEventListener("click", saveScene);
    elements.sceneModal.addEventListener("click", (e) => {
      if (e.target === elements.sceneModal) hideSceneModal();
    });

    // Settings
    elements.fuzzyMatch.addEventListener("change", (e) => {
      state.settings.fuzzyMatch = e.target.checked;
      saveSettings();
    });

    elements.caseInsensitive.addEventListener("change", (e) => {
      state.settings.caseInsensitive = e.target.checked;
      saveSettings();
    });

    // Duration overlay toggle
    if (elements.persistDuration) {
      elements.persistDuration.addEventListener("change", async (e) => {
        state.settings.persistDuration = e.target.checked;
        await saveSettings();
        await sendMessage({
          command: "TOGGLE_DURATION_OVERLAY",
          enabled: e.target.checked,
        });
      });
    }

    // Export/Import
    elements.exportConfig.addEventListener("click", exportConfig);
    elements.importConfig.addEventListener("click", () =>
      elements.importFile.click(),
    );
    elements.importFile.addEventListener("change", (e) => {
      if (e.target.files[0]) {
        importConfig(e.target.files[0]);
        e.target.value = "";
      }
    });

    // View mode toggle (Phase 2)
    if (elements.viewFlat) {
      elements.viewFlat.addEventListener("click", () => switchViewMode("flat"));
    }
    if (elements.viewGrouped) {
      elements.viewGrouped.addEventListener("click", () =>
        switchViewMode("grouped"),
      );
    }

    // Select all / none (Phase 2)
    if (elements.selectAll) {
      elements.selectAll.addEventListener("click", selectAllTracks);
    }
    if (elements.selectNone) {
      elements.selectNone.addEventListener("click", selectNoneTracks);
    }

    // Global unpin button
    if (elements.unpinAllGlobal) {
      elements.unpinAllGlobal.addEventListener("click", unpinAllTracks);
    }

    // Restore default button in modal
    if (elements.modalRestoreDefault) {
      elements.modalRestoreDefault.addEventListener(
        "click",
        restorePresetDefault,
      );
    }
    
    // URL Management
    if (elements.addUrlBtn) {
      elements.addUrlBtn.addEventListener("click", addSupportedUrl);
    }
    if (elements.newUrlInput) {
      elements.newUrlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addSupportedUrl();
      });
    }
  }

  // Initialize when DOM is ready
  document.addEventListener("DOMContentLoaded", init);
})();
