# Chrome Web Store Listing - Perfetto Auto-Pin

## Basic Information

**Extension Name:** Perfetto Auto-Pin

**Category:** Developer Tools

**Language:** Chinese (Simplified), English

---

## Chinese (简体中文)

### 简短描述 (132 字符以内)
一键 Pin 泳道到 Perfetto UI，内置 Android 性能分析场景预设，让 trace 分析更高效。

### 详细描述
Perfetto Auto-Pin 是一款专为 Android 性能分析工程师设计的 Chrome 扩展，帮助你在 Perfetto UI 中快速 Pin 需要关注的泳道。

**主要功能：**

📌 **预设场景一键应用**
- 帧率分析：Choreographer、RenderThread、VSYNC 等
- 启动分析：bindApplication、activityStart 等
- 输入响应：InputDispatcher、TouchLatency 等
- 内存分析：GC、HeapTaskDaemon 等
- Binder 调用：跨进程通信相关泳道
- SystemUI 分析：系统界面性能
- SurfaceFlinger：合成器相关
- CPU 调度：调度和频率相关

✏️ **自定义场景**
- 创建和保存自己的泳道组合
- 支持通配符匹配（如 Binder:*）
- 导入/导出配置，团队共享

🔍 **智能搜索**
- 模糊匹配泳道名称
- 支持通配符搜索
- 快速定位目标泳道

🔓 **便捷操作**
- 一键 Unpin 全部泳道
- 编辑预设场景的泳道列表
- 历史记录快速重用

**使用方法：**
1. 在 ui.perfetto.dev 打开 trace 文件
2. 点击扩展图标
3. 选择预设场景或自定义 Pin 泳道

**适用场景：**
- Android 应用性能优化
- 系统级性能分析
- 卡顿、启动、内存问题定位
- 性能测试与监控

作者：Gracker
更多 Android 性能优化技巧：androidperformance.com

---

## English

### Short Description (under 132 characters)
One-click pin tracks in Perfetto UI with built-in Android performance analysis presets for efficient trace analysis.

### Detailed Description
Perfetto Auto-Pin is a Chrome extension designed for Android performance engineers, helping you quickly pin tracks in Perfetto UI.

**Key Features:**

📌 **One-Click Preset Scenes**
- Frame Analysis: Choreographer, RenderThread, VSYNC, etc.
- Startup Analysis: bindApplication, activityStart, etc.
- Input Response: InputDispatcher, TouchLatency, etc.
- Memory Analysis: GC, HeapTaskDaemon, etc.
- Binder Calls: IPC-related tracks
- SystemUI Analysis: System UI performance
- SurfaceFlinger: Compositor-related
- CPU Scheduling: Scheduling and frequency

✏️ **Custom Scenes**
- Create and save your own track combinations
- Wildcard matching support (e.g., Binder:*)
- Import/Export configs for team sharing

🔍 **Smart Search**
- Fuzzy match track names
- Wildcard search support
- Quickly locate target tracks

🔓 **Convenient Operations**
- One-click unpin all tracks
- Edit preset scene track lists
- History for quick reuse

**How to Use:**
1. Open a trace file at ui.perfetto.dev
2. Click the extension icon
3. Select a preset scene or custom pin tracks

**Use Cases:**
- Android app performance optimization
- System-level performance analysis
- Jank, startup, memory issue diagnosis
- Performance testing and monitoring

Author: Gracker
More Android performance tips: androidperformance.com

---

## Screenshots Required

1. **Main popup with preset scenes** (1280x800 or 640x400)
   - Show the scene selection interface

2. **Track selection interface** (1280x800 or 640x400)
   - Show the track search and selection

3. **Preset scene editing** (1280x800 or 640x400)
   - Show the edit modal for preset scenes

4. **Settings page** (1280x800 or 640x400)
   - Show settings and about section

5. **Before/After comparison** (1280x800 or 640x400)
   - Show Perfetto UI with tracks pinned

---

## Promotional Images

### Small Promo Tile (440x280)
- Extension icon centered
- Name: "Perfetto Auto-Pin"
- Tagline: "Pin tracks with one click"

### Large Promo Tile (1280x800) - Optional
- Extension screenshot
- Feature highlights
- Branding

---

## Privacy Policy

See: PRIVACY_POLICY.md

---

## Additional Notes

- **Permissions Used:**
  - `storage`: Save user preferences and custom scenes
  - `activeTab`: Interact with Perfetto UI tab
  - `scripting`: Inject content script for track operations

- **Host Permissions:**
  - `https://ui.perfetto.dev/*`: Only works on Perfetto UI

- **No data collection**: All data stored locally in browser
