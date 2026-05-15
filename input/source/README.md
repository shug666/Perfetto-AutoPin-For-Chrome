# Perfetto Auto-Pin

A Chrome extension that automatically pins tracks in Perfetto UI for Android performance analysis.

## Features

### Phase 1 - Basic Features
- **Preset Scenes**: Pre-configured track sets for common Android performance analysis scenarios:
  - Frame Analysis (Choreographer, RenderThread, VSYNC, etc.)
  - Startup Analysis (main thread, bindApplication, ActivityManager, etc.)
  - Input Response (InputDispatcher, InputReader, touch events, etc.)
  - Memory Analysis (HeapTaskDaemon, GC, FinalizerDaemon, etc.)
  - Binder Calls (Binder transactions, main thread, etc.)

- **Custom Scenes**: Create and save your own track configurations
- **Track Selection**: Visual selector to pick tracks from the current trace
- **Fuzzy Matching**: Supports wildcard patterns (e.g., `vsync-*`, `Binder:*`)
- **Settings Persistence**: Saves custom scenes and settings to Chrome storage
- **Export/Import**: Share configurations between devices

### Phase 2 - Enhanced Features
- **Grouped View**: View tracks organized by process/category
- **Batch Selection**: Select all/none buttons and group-level selection
- **More Preset Scenes**: Added SystemUI, SurfaceFlinger, and CPU analysis scenes
- **Enhanced Search**: Improved wildcard pattern matching in search
- **Selection Counter**: Real-time display of selected track count

### Phase 3 - Advanced Features
- **History Tracking**: Automatically records recently used scenes
- **Quick Access**: One-click to reapply previous configurations
- **Keyboard Shortcuts**:
  - `Ctrl/Cmd + Shift + P`: Open extension popup
  - `Ctrl/Cmd + Enter`: Pin selected tracks
  - `Ctrl/Cmd + A`: Select all tracks (in tracks tab)
  - `1-9`: Quick apply preset scenes
  - `Escape`: Close modal
- **Full Export/Import**: Includes history in configuration backup

## Installation

### Developer Mode Installation

1. Clone or download this repository
2. Generate icons (if not present):
   ```bash
   python3 tools/generate_icons.py
   ```
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the `Perfetto-Auto-Pin` folder

### Usage

1. Open [Perfetto UI](https://ui.perfetto.dev/) and load a trace file
2. Click the Perfetto Auto-Pin extension icon
3. Choose a preset scene or select tracks manually
4. Click to apply - tracks will be pinned automatically!

## Project Structure

```
Perfetto-Auto-Pin/
├── manifest.json          # Chrome extension manifest
├── src/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Popup logic
│   ├── content.js         # Content script (Perfetto API integration)
│   ├── content.css        # Content script styles
│   └── background.js      # Service worker
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
└── tools/
    ├── generate_icons.py  # Icon generator
    └── generate-icons.html # Browser-based icon generator
```

## How It Works

The extension uses Perfetto's internal API (`window.app`) to interact with tracks:

1. **Track Discovery**: Reads all tracks from `workspace.flatTracks`
2. **Pattern Matching**: Supports exact, contains, and wildcard matching
3. **Pin Operation**: Calls `track.pin()` on matching TrackNode objects
4. **UI Refresh**: Triggers Perfetto's redraw via `window.raf`

## API Reference

### Content Script Commands

The content script (`content.js`) responds to these commands via `chrome.runtime.sendMessage`:

| Command | Parameters | Description |
|---------|------------|-------------|
| `PING` | - | Check if content script is ready |
| `GET_TRACKS` | - | Get all available tracks |
| `PIN_TRACKS` | `tracks: string[]` | Pin tracks by name patterns |
| `UNPIN_ALL` | - | Unpin all pinned tracks |
| `EXPAND_TRACKS` | `tracks: string[]` | Expand track groups |
| `FIND_TRACKS` | `pattern: string` | Find tracks matching pattern |
| `GET_STATUS` | - | Get manager status |

### Pattern Matching

| Pattern | Example | Matches |
|---------|---------|---------|
| Exact | `main` | `main` only |
| Contains | `vsync` | `VSYNC-app`, `vsync-sf`, etc. |
| Wildcard | `Binder:*` | `Binder:1234`, `Binder:5678`, etc. |
| Prefix | `com.android.*` | `com.android.systemui`, etc. |

## Development

### Prerequisites

- Python 3.x (for icon generation)
- Chrome browser
- Perfetto source code (optional, for API reference)

### Building

No build step required - the extension uses plain JavaScript.

### Testing

1. Load the extension in Chrome developer mode
2. Open https://ui.perfetto.dev/ with a trace file
3. Open the extension popup and test various scenarios

### Code Review Checklist

- [x] Manifest V3 compliance
- [x] Content script isolation
- [x] Proper error handling
- [x] Storage API usage
- [x] Message passing security
- [x] UI/UX consistency

## Roadmap

All planned features have been implemented:

- [x] **Phase 1**: Basic functionality - Preset scenes, custom scenes, track selection
- [x] **Phase 2**: Enhanced features - Grouped view, batch selection, more presets
- [x] **Phase 3**: Advanced features - History tracking, keyboard shortcuts, full export/import

### Future Enhancements
- [ ] Integration with Perfetto's command palette
- [ ] Cloud sync for configurations
- [ ] Auto-detection of app process for smart suggestions
- [ ] Custom keyboard shortcut configuration

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Acknowledgments

- [Perfetto](https://perfetto.dev/) - The trace analysis tool this extension enhances
- [Android Open Source Project](https://source.android.com/) - For the excellent Perfetto source code
