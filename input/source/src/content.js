// Perfetto Auto-Pin Content Script
// This script runs on ui.perfetto.dev and provides track pinning functionality
// by using Perfetto's internal API (window.app)

(function() {
  'use strict';

  const LOG_PREFIX = '[Perfetto Auto-Pin]';

  // Configuration
  const CONFIG = {
    retryDelay: 500,
    maxRetries: 60, // 30 seconds max wait
    apiCheckInterval: 100
  };

  /**
   * PerfettoTrackManager - Manages track operations using Perfetto's internal API
   */
  class PerfettoTrackManager {
    constructor() {
      this.isReady = false;
      this.app = null;
      this.init();
    }

    /**
     * Initialize the manager and wait for Perfetto API
     */
    async init() {
      console.log(`${LOG_PREFIX} Initializing...`);
      await this.waitForPerfettoAPI();
      console.log(`${LOG_PREFIX} Ready!`);
    }

    /**
     * Wait for Perfetto's window.app API to be available
     */
    async waitForPerfettoAPI() {
      return new Promise((resolve) => {
        let retries = 0;
        const check = () => {
          // Check if window.app is available (Perfetto exposes this in debug.ts)
          if (window.app && window.app.trace) {
            this.app = window.app;
            this.isReady = true;
            console.log(`${LOG_PREFIX} Perfetto API detected`);
            resolve();
            return;
          }

          retries++;
          if (retries < CONFIG.maxRetries) {
            setTimeout(check, CONFIG.retryDelay);
          } else {
            console.warn(`${LOG_PREFIX} Timeout waiting for Perfetto API, some features may not work`);
            this.isReady = false;
            resolve();
          }
        };
        check();
      });
    }

    /**
     * Get the current trace context
     */
    getTrace() {
      return this.app?.trace;
    }

    /**
     * Get the current workspace
     */
    getWorkspace() {
      const trace = this.getTrace();
      // Perfetto API: trace.workspaces.currentWorkspace (not trace.workspace)
      return trace?.workspaces?.currentWorkspace;
    }

    /**
     * Get all tracks from the current workspace
     * @returns {Array} Array of track objects with name, uri, pinned status
     */
    getAllTracks() {
      const workspace = this.getWorkspace();
      if (!workspace) {
        console.warn(`${LOG_PREFIX} No workspace available`);
        return [];
      }

      const tracks = [];
      // flatTracks can be either a method (newer Perfetto) or a property (older versions)
      const flatTracks = typeof workspace.flatTracks === 'function'
        ? workspace.flatTracks()
        : (workspace.flatTracks || []);

      for (const track of flatTracks) {
        tracks.push({
          name: track.name || '',
          uri: track.uri || '',
          pinned: track.isPinned || false,
          hasChildren: track.hasChildren || false,
          collapsed: track.collapsed,
          // Keep reference to original track for operations
          _trackNode: track
        });
      }

      console.log(`${LOG_PREFIX} Found ${tracks.length} tracks`);
      return tracks;
    }

    /**
     * Get pinned tracks from the current workspace
     * @returns {Array} Array of pinned track names
     */
    getPinnedTracks() {
      const workspace = this.getWorkspace();
      if (!workspace) return [];

      // pinnedTracks can be either a method (newer Perfetto) or a property (older versions)
      const pinnedTracks = typeof workspace.pinnedTracks === 'function'
        ? workspace.pinnedTracks()
        : (workspace.pinnedTracks || []);
      return pinnedTracks.map(t => ({
        name: t.name,
        uri: t.uri
      }));
    }

    /**
     * Check if a track name matches a pattern
     * @param {string} name - Track name to check
     * @param {string} pattern - Pattern to match (supports * wildcard)
     * @param {boolean} fuzzy - Enable fuzzy matching
     * @returns {boolean}
     */
    matchesPattern(name, pattern, fuzzy = true) {
      if (!name || !pattern) return false;

      // Exact match
      if (name === pattern) return true;

      if (fuzzy) {
        const nameLower = name.toLowerCase();
        const patternLower = pattern.toLowerCase();

        // Case-insensitive exact match
        if (nameLower === patternLower) return true;

        // Contains match
        if (nameLower.includes(patternLower)) return true;

        // Wildcard match (e.g., "vsync-*", "*main*")
        if (pattern.includes('*')) {
          const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
            .replace(/\*/g, '.*'); // Convert * to .*
          const regex = new RegExp(`^${regexPattern}$`, 'i');
          if (regex.test(name)) return true;
        }

        // Starts with match
        if (nameLower.startsWith(patternLower)) return true;
      }

      return false;
    }

    /**
     * Find tracks matching a pattern
     * @param {string} pattern - Pattern to match
     * @param {boolean} fuzzy - Enable fuzzy matching
     * @returns {Array} Matching tracks
     */
    findMatchingTracks(pattern, fuzzy = true) {
      const allTracks = this.getAllTracks();
      return allTracks.filter(track => this.matchesPattern(track.name, pattern, fuzzy));
    }

    /**
     * Pin a single track by its TrackNode
     * @param {Object} trackNode - Perfetto TrackNode object
     * @returns {boolean} Success status
     */
    pinTrackNode(trackNode) {
      try {
        if (trackNode && typeof trackNode.pin === 'function') {
          trackNode.pin();
          return true;
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error pinning track:`, error);
      }
      return false;
    }

    /**
     * Unpin a single track by its TrackNode
     * @param {Object} trackNode - Perfetto TrackNode object
     * @returns {boolean} Success status
     */
    unpinTrackNode(trackNode) {
      try {
        if (trackNode && typeof trackNode.unpin === 'function') {
          trackNode.unpin();
          return true;
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error unpinning track:`, error);
      }
      return false;
    }

    /**
     * Expand a track group
     * @param {Object} trackNode - Perfetto TrackNode object
     */
    expandTrackNode(trackNode) {
      try {
        if (trackNode && typeof trackNode.expand === 'function') {
          trackNode.expand();
          return true;
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error expanding track:`, error);
      }
      return false;
    }

    /**
     * Reorder pinned tracks in Perfetto's internal tree to match a desired order.
     * Perfetto may re-sort pinned tracks internally (e.g. alphabetically),
     * so we directly manipulate the container node's children after pinning.
     * @param {Array<string>} desiredNameOrder - Track names in desired display order
     */
    reorderPinnedTracks(desiredNameOrder) {
      const workspace = this.getWorkspace();
      if (!workspace) return;

      const pinnedTracksRaw = typeof workspace.pinnedTracks === 'function'
        ? workspace.pinnedTracks()
        : (workspace.pinnedTracks || []);
      const pinnedTracks = [...pinnedTracksRaw];

      if (pinnedTracks.length === 0) return;

      // Find the pinned tracks container via the parent of any pinned track
      const container = pinnedTracks[0].parent;
      if (!container) {
        console.warn(`${LOG_PREFIX} Cannot reorder: pinned track has no parent`);
        return;
      }

      const hasRemoveChild = typeof container.removeChild === 'function';
      const hasAddChildLast = typeof container.addChildLast === 'function';

      if (!hasRemoveChild || !hasAddChildLast) {
        console.warn(`${LOG_PREFIX} Cannot reorder: container API not available (removeChild=${hasRemoveChild}, addChildLast=${hasAddChildLast})`);
        return;
      }

      // Build order map: scene tracks first in defined order, then other pinned tracks
      const orderMap = new Map();
      desiredNameOrder.forEach((name, index) => orderMap.set(name, index));

      const sceneTracks = [];
      const otherTracks = [];

      for (const track of pinnedTracks) {
        if (orderMap.has(track.name)) {
          sceneTracks.push(track);
        } else {
          otherTracks.push(track);
        }
      }

      sceneTracks.sort((a, b) => orderMap.get(a.name) - orderMap.get(b.name));
      const reordered = [...sceneTracks, ...otherTracks];

      // Remove all children then re-add in target order
      for (const track of reordered) {
        try { container.removeChild(track); } catch (e) { /* ignore */ }
      }
      for (const track of reordered) {
        try { container.addChildLast(track); } catch (e) { /* ignore */ }
      }

      console.log(`${LOG_PREFIX} Reordered ${sceneTracks.length} pinned tracks to match scene order`);
    }

    /**
     * Pin tracks by name patterns, preserving the order defined in patterns.
     * Three-phase approach: collect matches in pattern order, unpin+repin, then force-reorder the tree.
     * @param {Array<string>} patterns - Array of track name patterns
     * @param {boolean} fuzzy - Enable fuzzy matching
     * @returns {Object} Results with success and notFound arrays
     */
    pinTracksByPatterns(patterns, fuzzy = true) {
      const results = {
        success: [],
        notFound: [],
        alreadyPinned: []
      };

      if (!this.isReady) {
        console.warn(`${LOG_PREFIX} Manager not ready`);
        return results;
      }

      const allTracks = this.getAllTracks();

      // Phase 1: Collect matching tracks in pattern-defined order (deduplicated)
      const orderedMatches = [];
      const seenNames = new Set();

      for (const pattern of patterns) {
        let matched = false;

        for (const track of allTracks) {
          if (this.matchesPattern(track.name, pattern, fuzzy) && !seenNames.has(track.name)) {
            matched = true;
            seenNames.add(track.name);
            orderedMatches.push(track);
          }
        }

        if (!matched) {
          results.notFound.push(pattern);
          console.log(`${LOG_PREFIX} Not found: ${pattern}`);
        }
      }

      // Phase 2a: Unpin already-pinned tracks among matches so repin respects order
      for (const track of orderedMatches) {
        if (track.pinned) {
          this.unpinTrackNode(track._trackNode);
        }
      }

      // Phase 2b: Pin all matched tracks in the collected order
      for (const track of orderedMatches) {
        const success = this.pinTrackNode(track._trackNode);
        if (success) {
          results.success.push(track.name);
          console.log(`${LOG_PREFIX} Pinned: ${track.name}`);
        }
      }

      // Phase 3: Force-reorder pinned tracks in Perfetto's internal tree
      this.reorderPinnedTracks(orderedMatches.map(t => t.name));

      // Trigger UI refresh
      this.triggerRefresh();

      return results;
    }

    /**
     * Unpin all currently pinned tracks
     */
    unpinAllTracks() {
      const workspace = this.getWorkspace();
      if (!workspace) return;

      // pinnedTracks can be either a method (newer Perfetto) or a property (older versions)
      const pinnedTracksRaw = typeof workspace.pinnedTracks === 'function'
        ? workspace.pinnedTracks()
        : (workspace.pinnedTracks || []);
      const pinnedTracks = [...pinnedTracksRaw];
      for (const track of pinnedTracks) {
        this.unpinTrackNode(track);
      }

      this.triggerRefresh();
    }

    /**
     * Expand track groups that match patterns
     * @param {Array<string>} patterns - Patterns to match
     */
    expandTracksByPatterns(patterns) {
      const allTracks = this.getAllTracks();

      for (const pattern of patterns) {
        for (const track of allTracks) {
          if (track.hasChildren && this.matchesPattern(track.name, pattern, true)) {
            this.expandTrackNode(track._trackNode);
            console.log(`${LOG_PREFIX} Expanded: ${track.name}`);
          }
        }
      }

      this.triggerRefresh();
    }

    /**
     * Trigger Perfetto UI refresh
     */
    triggerRefresh() {
      try {
        if (window.raf && typeof window.raf.scheduleFullRedraw === 'function') {
          window.raf.scheduleFullRedraw();
        }
      } catch (error) {
        // Ignore refresh errors
      }
    }

    /**
     * Get status information
     */
    getStatus() {
      return {
        ready: this.isReady,
        hasApp: !!this.app,
        hasTrace: !!this.getTrace(),
        hasWorkspace: !!this.getWorkspace(),
        trackCount: this.getAllTracks().length,
        pinnedCount: this.getPinnedTracks().length
      };
    }
  }

  /**
   * DurationOverlayManager - Persistent duration labels for SpanNotes
   * Renders DOM overlays above the Perfetto timeline canvas showing
   * duration info for all Shift+M created span notes.
   */
  class DurationOverlayManager {
    constructor(trackManager) {
      this.trackManager = trackManager;
      this.container = null;
      this.labelPool = new Map(); // note.id -> DOM element
      this.rafId = null;
      this.enabled = false;
      this.lastWindowStart = null;
      this.lastWindowEnd = null;
      this.lastNotesSnapshot = '';
      this.lastTraceRef = null;
    }

    getTrace() {
      return this.trackManager.getTrace();
    }

    /**
     * Check if required Perfetto APIs are available
     */
    checkAPIs() {
      const trace = this.getTrace();
      if (!trace) return false;
      if (!trace.notes || !trace.notes.notes) {
        console.warn(`${LOG_PREFIX} Duration overlay: trace.notes API unavailable`);
        return false;
      }
      if (!trace.timeline || !trace.timeline.visibleWindow) {
        console.warn(`${LOG_PREFIX} Duration overlay: timeline.visibleWindow API unavailable`);
        return false;
      }
      return true;
    }

    /**
     * Get the track shell width from CSS variable
     */
    getShellWidth() {
      return parseInt(
        getComputedStyle(document.body).getPropertyValue('--track-shell-width') || '100', 10
      );
    }

    /**
     * Find the timeline header element
     */
    findHeaderElement() {
      return document.querySelector('.pf-timeline-header');
    }

    /**
     * Create the overlay container using fixed positioning
     */
    initOverlayContainer() {
      if (this.container) return;

      this.container = document.createElement('div');
      this.container.className = 'perfetto-duration-overlay-container';
      document.body.appendChild(this.container);
    }

    /**
     * Get all persistent SpanNotes (exclude __temp__)
     */
    getSpanNotes() {
      const trace = this.getTrace();
      if (!trace || !trace.notes || !trace.notes.notes) return [];

      const spanNotes = [];
      for (const [id, note] of trace.notes.notes) {
        if (note.noteType === 'SPAN' && id !== '__temp__') {
          spanNotes.push(note);
        }
      }
      return spanNotes;
    }

    /**
     * Convert a time value to pixel X coordinate
     */
    timeToPx(timeVal, windowStart, windowEnd, contentWidth) {
      const start = typeof windowStart === 'bigint' ? windowStart : BigInt(Math.round(Number(windowStart)));
      const end = typeof windowEnd === 'bigint' ? windowEnd : BigInt(Math.round(Number(windowEnd)));
      const t = typeof timeVal === 'bigint' ? timeVal : BigInt(Math.round(Number(timeVal)));

      const duration = end - start;
      if (duration <= 0n) return 0;

      return Number((t - start) * BigInt(Math.round(contentWidth * 1000)) / duration) / 1000;
    }

    /**
     * Format duration in appropriate units
     */
    formatDuration(durationNs) {
      const ns = typeof durationNs === 'bigint' ? Number(durationNs) : durationNs;
      const absNs = Math.abs(ns);

      if (absNs < 1000) {
        return `${Math.round(ns)} ns`;
      } else if (absNs < 1000000) {
        return `${(ns / 1000).toFixed(2)} µs`;
      } else if (absNs < 1000000000) {
        return `${(ns / 1000000).toFixed(2)} ms`;
      } else {
        return `${(ns / 1000000000).toFixed(2)} s`;
      }
    }

    /**
     * Build a snapshot string for change detection
     */
    buildNotesSnapshot(spanNotes) {
      return spanNotes.map(n =>
        `${n.id}|${n.start}|${n.end}|${n.color}`
      ).join(';');
    }

    /**
     * Get visible window time boundaries
     */
    getVisibleWindow() {
      const trace = this.getTrace();
      if (!trace || !trace.timeline) return null;

      const vw = trace.timeline.visibleWindow;
      if (!vw) return null;

      let start, end;
      if (vw.start && typeof vw.start.integral !== 'undefined') {
        start = vw.start.integral;
        end = vw.end.integral;
      } else if (typeof vw.start === 'bigint') {
        start = vw.start;
        end = vw.end;
      } else {
        const span = typeof vw.toTimeSpan === 'function' ? vw.toTimeSpan() : null;
        if (span) {
          start = span.start;
          end = span.end;
        } else {
          return null;
        }
      }
      return { start, end };
    }

    /**
     * Check if a span note overlaps the visible window
     */
    isNoteVisible(note, wStart, wEnd) {
      const nStart = typeof note.start === 'bigint' ? note.start : BigInt(Math.round(Number(note.start)));
      const nEnd = typeof note.end === 'bigint' ? note.end : BigInt(Math.round(Number(note.end)));
      const ws = typeof wStart === 'bigint' ? wStart : BigInt(Math.round(Number(wStart)));
      const we = typeof wEnd === 'bigint' ? wEnd : BigInt(Math.round(Number(wEnd)));
      return nEnd > ws && nStart < we;
    }

    /**
     * Create or update a label DOM element for a SpanNote
     */
    getOrCreateLabel(noteId) {
      if (this.labelPool.has(noteId)) {
        return this.labelPool.get(noteId);
      }

      const label = document.createElement('div');
      label.className = 'perfetto-duration-label';

      const leftBar = document.createElement('div');
      leftBar.className = 'perfetto-duration-label-bar perfetto-duration-label-bar-left';

      const line = document.createElement('div');
      line.className = 'perfetto-duration-label-line';

      const textEl = document.createElement('span');
      textEl.className = 'perfetto-duration-label-text';

      const rightBar = document.createElement('div');
      rightBar.className = 'perfetto-duration-label-bar perfetto-duration-label-bar-right';

      label.appendChild(leftBar);
      label.appendChild(line);
      label.appendChild(textEl);
      label.appendChild(rightBar);

      this.container.appendChild(label);
      this.labelPool.set(noteId, label);
      return label;
    }

    /**
     * Render all visible SpanNote overlays
     */
    renderOverlays() {
      if (!this.container) return;

      const window_ = this.getVisibleWindow();
      if (!window_) return;

      const headerEl = this.findHeaderElement();
      if (!headerEl) return;

      const headerRect = headerEl.getBoundingClientRect();
      const shellWidth = this.getShellWidth();

      // Use the actual canvas element to get precise content area boundaries
      const canvasEl = headerEl.querySelector('canvas');
      const TIME_AXIS_HEIGHT = 22;

      let contentLeft, contentWidth;
      if (canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        contentLeft = canvasRect.left + shellWidth;
        contentWidth = canvasRect.width - shellWidth;
      } else {
        contentLeft = headerRect.left + shellWidth;
        contentWidth = headerRect.width - shellWidth;
      }

      this.container.style.top = (headerRect.top + TIME_AXIS_HEIGHT) + 'px';
      this.container.style.left = contentLeft + 'px';
      this.container.style.width = contentWidth + 'px';

      const { start: wStart, end: wEnd } = window_;

      if (contentWidth <= 0) return;

      const spanNotes = this.getSpanNotes();
      const activeIds = new Set();

      for (const note of spanNotes) {
        if (!this.isNoteVisible(note, wStart, wEnd)) continue;

        activeIds.add(note.id);
        const label = this.getOrCreateLabel(note.id);
        label.style.display = '';

        const xLeft = this.timeToPx(note.start, wStart, wEnd, contentWidth);
        const xRight = this.timeToPx(note.end, wStart, wEnd, contentWidth);
        const width = xRight - xLeft;

        label.style.transform = `translateX(${xLeft}px)`;
        label.style.width = `${Math.max(width, 2)}px`;

        const durationNs = typeof note.end === 'bigint' && typeof note.start === 'bigint'
          ? note.end - note.start
          : Number(note.end) - Number(note.start);
        const textEl = label.querySelector('.perfetto-duration-label-text');
        textEl.textContent = this.formatDuration(durationNs);

        const lineEl = label.querySelector('.perfetto-duration-label-line');
        lineEl.style.backgroundColor = note.color || '#ff0000';

        const bars = label.querySelectorAll('.perfetto-duration-label-bar');
        bars.forEach(bar => { bar.style.backgroundColor = note.color || '#ff0000'; });
      }

      // Hide labels for notes that are no longer visible or removed
      for (const [id, el] of this.labelPool) {
        if (!activeIds.has(id)) {
          el.style.display = 'none';
        }
      }

      // Remove labels for deleted notes
      for (const [id, el] of this.labelPool) {
        if (!spanNotes.some(n => n.id === id)) {
          el.remove();
          this.labelPool.delete(id);
        }
      }
    }

    /**
     * rAF render loop with change detection
     */
    startRenderLoop() {
      if (this.rafId !== null) return;

      const loop = () => {
        if (!this.enabled) return;

        // Detect trace switch
        const currentTrace = this.getTrace();
        if (currentTrace !== this.lastTraceRef) {
          this.lastTraceRef = currentTrace;
          this.clearAllLabels();
          if (!this.checkAPIs()) {
            this.rafId = requestAnimationFrame(loop);
            return;
          }
        }

        const window_ = this.getVisibleWindow();
        const spanNotes = this.getSpanNotes();
        const snapshot = this.buildNotesSnapshot(spanNotes);

        const windowStartStr = window_ ? String(window_.start) : '';
        const windowEndStr = window_ ? String(window_.end) : '';

        const changed = windowStartStr !== String(this.lastWindowStart)
          || windowEndStr !== String(this.lastWindowEnd)
          || snapshot !== this.lastNotesSnapshot;

        if (changed) {
          this.lastWindowStart = window_ ? window_.start : null;
          this.lastWindowEnd = window_ ? window_.end : null;
          this.lastNotesSnapshot = snapshot;
          this.renderOverlays();
        }

        this.rafId = requestAnimationFrame(loop);
      };

      this.rafId = requestAnimationFrame(loop);
    }

    /**
     * Stop the render loop and clean up
     */
    stopRenderLoop() {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.clearAllLabels();
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }

    clearAllLabels() {
      for (const [, el] of this.labelPool) {
        el.remove();
      }
      this.labelPool.clear();
      this.lastNotesSnapshot = '';
    }

    /**
     * Start the overlay system
     */
    start() {
      if (this.enabled) return;
      if (!this.checkAPIs()) return;

      this.enabled = true;
      this.initOverlayContainer();
      this.startRenderLoop();
      console.log(`${LOG_PREFIX} Duration overlay started`);
    }

    /**
     * Stop the overlay system
     */
    stop() {
      this.enabled = false;
      this.stopRenderLoop();
      console.log(`${LOG_PREFIX} Duration overlay stopped`);
    }

    getStatus() {
      return {
        enabled: this.enabled,
        noteCount: this.getSpanNotes().length,
      };
    }
  }

  // Create global instance
  window.perfettoTrackManager = new PerfettoTrackManager();
  window.perfettoDurationOverlay = new DurationOverlayManager(window.perfettoTrackManager);

  // Message handling via postMessage (bridged from chrome.runtime by bridge.js)
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'PERFETTO_AUTO_PIN_COMMAND') return;

    const { command, payload, messageId } = event.data;
    const manager = window.perfettoTrackManager;

    console.log(`${LOG_PREFIX} Received command: ${command}`);

    let response = {};

    switch (command) {
      case 'PING':
        response = {
          status: 'ok',
          ready: manager.isReady,
          ...manager.getStatus()
        };
        break;

      case 'GET_TRACKS':
        const tracks = manager.getAllTracks();
        response = {
          tracks: tracks.map(t => ({
            name: t.name,
            uri: t.uri,
            pinned: t.pinned,
            hasChildren: t.hasChildren
          }))
        };
        break;

      case 'GET_PINNED_TRACKS':
        response = {
          tracks: manager.getPinnedTracks()
        };
        break;

      case 'PIN_TRACKS':
        response = manager.pinTracksByPatterns(
          payload?.tracks || [],
          payload?.fuzzy !== false
        );
        break;

      case 'UNPIN_ALL':
        manager.unpinAllTracks();
        response = { success: true };
        break;

      case 'EXPAND_TRACKS':
        manager.expandTracksByPatterns(payload?.tracks || []);
        response = { success: true };
        break;

      case 'FIND_TRACKS':
        const matching = manager.findMatchingTracks(
          payload?.pattern,
          payload?.fuzzy !== false
        );
        response = {
          tracks: matching.map(t => ({
            name: t.name,
            uri: t.uri,
            pinned: t.pinned
          }))
        };
        break;

      case 'GET_STATUS':
        response = manager.getStatus();
        break;

      case 'TOGGLE_DURATION_OVERLAY':
        const overlay = window.perfettoDurationOverlay;
        if (payload?.enabled) {
          overlay.start();
        } else {
          overlay.stop();
        }
        response = { success: true, ...overlay.getStatus() };
        break;

      case 'GET_DURATION_OVERLAY_STATUS':
        response = window.perfettoDurationOverlay.getStatus();
        break;

      default:
        response = { error: 'Unknown command' };
    }

    // Send response back through postMessage
    window.postMessage({
      type: 'PERFETTO_AUTO_PIN_RESPONSE',
      command: command,
      messageId: messageId,
      data: response
    }, '*');
  });

  // Auto-start duration overlay after Perfetto API is ready
  (async function initDurationOverlay() {
    const manager = window.perfettoTrackManager;
    const overlay = window.perfettoDurationOverlay;

    // Wait for Perfetto API to be ready
    const waitForReady = () => new Promise(resolve => {
      const check = () => {
        if (manager.isReady) { resolve(); return; }
        setTimeout(check, 500);
      };
      check();
    });

    await waitForReady();

    // Check stored setting (default: enabled)
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['settings'], (data) => {
          const persistDuration = data?.settings?.persistDuration !== false;
          if (persistDuration) {
            overlay.start();
          }
        });
      } else {
        // No chrome.storage access in MAIN world, start by default
        overlay.start();
      }
    } catch (e) {
      // MAIN world cannot access chrome.storage, start by default
      overlay.start();
    }
  })();

  console.log(`${LOG_PREFIX} Content script loaded`);
})();
