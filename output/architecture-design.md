# Perfetto Auto-Pin 架构设计文档

> **版本**: 1.0.0  
> **作者**: Gracker  
> **生成日期**: 2026-03-12  
> **项目定位**: Chrome 扩展 — 面向 Android 性能分析的 Perfetto UI 泳道自动 Pin 工具

---

## 1. 项目概述

Perfetto Auto-Pin 是一款基于 Manifest V3 的 Chrome 扩展，运行在 `https://ui.perfetto.dev` 页面上。它通过调用 Perfetto 内部 API（`window.app`）实现对 trace 文件中泳道（Track）的自动发现、模式匹配和批量 Pin 操作，极大提升了 Android 性能分析的工作效率。

### 核心能力

| 能力 | 说明 |
|------|------|
| 场景预设 | 内置 8 种 Android 性能分析场景（帧率、启动、输入、内存、Binder、SystemUI、SurfaceFlinger、CPU） |
| 自定义场景 | 用户可创建/编辑/删除自定义泳道组合 |
| 预设编辑 | 支持修改内置预设，并可恢复默认 |
| 通配符匹配 | 支持 `*` 通配符、模糊匹配、大小写不敏感匹配 |
| 分组视图 | 按进程/类别对泳道进行分组展示 |
| 历史记录 | 自动记录最近 5 次 Pin 操作，支持一键复用 |
| 快捷键 | 完整的键盘快捷键体系 |
| 配置导入/导出 | JSON 格式完整配置备份与恢复 |
| 国际化 | 支持中文/英文双语 |

---

## 2. 整体架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                              │
│                                                                     │
│  ┌──────────────┐    chrome.runtime     ┌────────────────────────┐  │
│  │   Popup UI   │ ──────────────────▶   │  Background Service    │  │
│  │  (popup.*)   │   onMessage           │  Worker (background.js)│  │
│  └──────┬───────┘                       └────────────────────────┘  │
│         │                                                           │
│         │ chrome.tabs.sendMessage                                   │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │                 ui.perfetto.dev 页面                      │       │
│  │                                                          │       │
│  │  ┌─────────────────┐   window.postMessage  ┌──────────┐ │       │
│  │  │   Bridge Script │ ◀═══════════════════▶ │ Content  │ │       │
│  │  │  (ISOLATED world)│                       │  Script  │ │       │
│  │  │   bridge.js      │                       │ (MAIN    │ │       │
│  │  └─────────────────┘                       │  world)  │ │       │
│  │                                            │content.js│ │       │
│  │                                            └────┬─────┘ │       │
│  │                                                 │       │       │
│  │                                                 ▼       │       │
│  │                                        ┌──────────────┐ │       │
│  │                                        │ Perfetto API │ │       │
│  │                                        │ window.app   │ │       │
│  │                                        │ window.raf   │ │       │
│  │                                        └──────────────┘ │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │                  Chrome Storage API                       │       │
│  │  chrome.storage.sync                                      │       │
│  │  ┌──────────┬────────────┬──────────┬────────────────┐   │       │
│  │  │customScen│  settings  │ history  │modifiedPresets │   │       │
│  │  │   es     │            │          │                │   │       │
│  │  └──────────┴────────────┴──────────┴────────────────┘   │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 执行环境隔离

Chrome 扩展的安全模型要求不同脚本运行在不同的隔离世界（World）中，本项目的关键架构决策之一就是通过 Bridge 模式解决跨世界通信问题。

```
┌────────────────────────────────────────────────────────────────┐
│                      三个执行上下文                              │
│                                                                │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Extension      │  │  ISOLATED       │  │  MAIN World     │  │
│  │  Context        │  │  World          │  │  (Page Context) │  │
│  │                 │  │                 │  │                 │  │
│  │  popup.js       │  │  bridge.js      │  │  content.js     │  │
│  │  background.js  │  │                 │  │                 │  │
│  │                 │  │  可访问:         │  │  可访问:         │  │
│  │  可访问:         │  │  · chrome API   │  │  · window.app   │  │
│  │  · chrome API   │  │  · DOM          │  │  · window.raf   │  │
│  │  · popup DOM    │  │  · postMessage  │  │  · DOM          │  │
│  │                 │  │                 │  │  · postMessage  │  │
│  │  不可访问:       │  │  不可访问:       │  │                 │  │
│  │  · page JS      │  │  · window.app   │  │  不可访问:       │  │
│  │  · window.app   │  │  · page JS vars │  │  · chrome API   │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│         │                    │                    │             │
│         │  chrome.runtime    │  window.postMessage │             │
│         │  .sendMessage      │  (双向)             │             │
│         └────────────────────┘────────────────────┘             │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. 组件详细设计

### 3.1 Manifest 配置 (`manifest.json`)

**协议版本**: Manifest V3

```
manifest.json
├── permissions: [storage, activeTab, scripting]
├── host_permissions: [https://ui.perfetto.dev/*]
├── content_scripts
│   ├── matches: [https://ui.perfetto.dev/*]
│   ├── js: [src/bridge.js]          ← ISOLATED world
│   ├── css: [src/content.css]
│   └── run_at: document_idle
├── web_accessible_resources
│   └── src/content.js               ← 允许被页面加载
├── background
│   └── service_worker: src/background.js
├── action
│   └── default_popup: src/popup.html
├── commands
│   └── _execute_action: Ctrl+Shift+P
└── default_locale: en
```

**设计要点**:
- `bridge.js` 作为 content_script 自动注入 ISOLATED world
- `content.js` 声明为 `web_accessible_resources`，由 bridge.js 动态注入到 MAIN world
- 仅申请最小权限集：`storage`（持久化）、`activeTab`（当前标签）、`scripting`（脚本注入）

### 3.2 Background Service Worker (`background.js`)

**职责**: 扩展生命周期管理、标签页状态监控、快捷键全局命令处理。

```
background.js
│
├── 安装/更新事件监听
│   └── chrome.runtime.onInstalled
│
├── 标签页状态监控
│   └── chrome.tabs.onUpdated
│       ├── Perfetto 页面 → Badge 显示 "ON"（绿色）
│       └── 其他页面 → Badge 清除
│
├── 消息处理
│   └── chrome.runtime.onMessage
│       └── GET_TAB_INFO → 返回当前活动标签信息
│
└── 快捷键命令
    └── chrome.commands.onCommand
        ├── quick-pin → 打开 popup
        └── apply-last-scene → 应用最近使用的场景
```

**设计特点**: 作为 Manifest V3 的 Service Worker，无持久化后台页面，按需激活。

### 3.3 Bridge 脚本 (`bridge.js`)

**职责**: 跨世界通信桥梁，连接 Chrome Extension API 与 Perfetto 页面上下文。

```
bridge.js（ISOLATED world）
│
├── 初始化
│   └── 动态注入 content.js 到 MAIN world
│       └── document.createElement('script')
│           └── src = chrome.runtime.getURL('src/content.js')
│
├── Popup → Content 消息转发
│   ├── chrome.runtime.onMessage（接收 popup 消息）
│   ├── 生成 messageId（唯一标识请求-响应对）
│   ├── window.postMessage（转发到 MAIN world）
│   └── 监听响应并通过 sendResponse 回传
│       └── 10 秒超时清理
│
└── Content → Background 事件转发
    └── window.addEventListener('message')
        └── 类型 PERFETTO_AUTO_PIN_EVENT → chrome.runtime.sendMessage
```

**消息路由流程**:

```
Popup ──chrome.tabs.sendMessage──▶ Bridge ──window.postMessage──▶ Content
  ▲                                  │                              │
  │                                  │◀──window.postMessage─────────┘
  │◀──sendResponse───────────────────┘
```

**请求-响应匹配机制**: 通过 `messageId`（时间戳 + 随机字符串）唯一标识每次请求，确保异步响应正确关联。

### 3.4 Content Script (`content.js`)

**职责**: 运行在 MAIN world，直接操作 Perfetto 内部 API，实现核心泳道管理功能。

#### 3.4.1 PerfettoTrackManager 类

```
PerfettoTrackManager
│
├── 属性
│   ├── isReady: boolean          // API 就绪状态
│   └── app: Object               // window.app 引用
│
├── 初始化
│   └── waitForPerfettoAPI()
│       └── 轮询等待 window.app.trace 可用
│           ├── 间隔: 500ms
│           ├── 最大重试: 60 次（30 秒）
│           └── 超时降级: isReady = false
│
├── 数据读取
│   ├── getTrace()                 // → app.trace
│   ├── getWorkspace()             // → trace.workspaces.currentWorkspace
│   ├── getAllTracks()             // → workspace.flatTracks
│   │   └── 返回: [{name, uri, pinned, hasChildren, collapsed, _trackNode}]
│   └── getPinnedTracks()          // → workspace.pinnedTracks
│
├── 模式匹配
│   └── matchesPattern(name, pattern, fuzzy)
│       ├── 精确匹配
│       ├── 大小写不敏感匹配
│       ├── 包含匹配（contains）
│       ├── 通配符匹配（* → .* 正则）
│       └── 前缀匹配（startsWith）
│
├── 泳道操作
│   ├── pinTrackNode(trackNode)    // trackNode.pin()
│   ├── unpinTrackNode(trackNode)  // trackNode.unpin()
│   ├── expandTrackNode(trackNode) // trackNode.expand()
│   ├── pinTracksByPatterns(patterns, fuzzy)
│   │   └── 返回: {success[], notFound[], alreadyPinned[]}
│   ├── unpinAllTracks()
│   └── expandTracksByPatterns(patterns)
│
├── UI 刷新
│   └── triggerRefresh()
│       └── window.raf.scheduleFullRedraw()
│
└── 状态查询
    └── getStatus()
        └── 返回: {ready, hasApp, hasTrace, hasWorkspace, trackCount, pinnedCount}
```

#### 3.4.2 消息命令处理

```
命令处理器（window.addEventListener('message')）
│
├── PING                → 连接检测 + 状态返回
├── GET_TRACKS          → 获取所有泳道列表
├── GET_PINNED_TRACKS   → 获取已 Pin 泳道
├── PIN_TRACKS          → 按模式批量 Pin
├── UNPIN_ALL           → 取消所有 Pin
├── EXPAND_TRACKS       → 展开匹配的泳道组
├── FIND_TRACKS         → 搜索匹配泳道
└── GET_STATUS          → 获取管理器状态
```

### 3.5 Popup UI (`popup.html` / `popup.css` / `popup.js`)

#### 3.5.1 UI 结构

```
Popup UI
│
├── Header
│   ├── 标题: "📌 Perfetto Auto-Pin"
│   └── 状态指示器: checking / ready / error
│
├── 未连接警告
│   └── 非 Perfetto 页面时显示
│
└── 主内容区（Tab 导航）
    │
    ├── 「场景预设」Tab
    │   ├── Unpin 全部按钮
    │   ├── 最近使用（历史记录，最多 5 条）
    │   ├── 预设场景列表（8 个内置场景）
    │   │   └── 每项: [图标] [名称+泳道数] [应用|编辑|Unpin]
    │   └── 自定义场景列表
    │       └── 每项: [图标] [名称+泳道数] [应用|编辑|Unpin|删除]
    │
    ├── 「泳道选择」Tab
    │   ├── 搜索框（支持通配符 *）
    │   ├── 工具栏
    │   │   ├── 视图切换: 平铺 / 分组
    │   │   └── 批量操作: 全选 / 取消 / 已选计数
    │   ├── 泳道列表（平铺/分组视图）
    │   └── 操作区: Pin 选中 / 保存为场景
    │
    └── 「设置」Tab
        ├── 匹配设置: 模糊匹配 / 忽略大小写
        ├── 数据管理: 导出/导入配置
        └── 关于信息
```

#### 3.5.2 应用状态模型

```javascript
state = {
  currentTab: Tab,              // 当前浏览器标签页
  tracks: Track[],              // 从 Perfetto 获取的泳道列表
  selectedTracks: Set<string>,  // 用户选中的泳道名称集合
  customScenes: Scene[],        // 用户自定义场景
  modifiedPresets: {            // 用户修改过的预设场景覆盖
    [presetId]: { tracks, icon }
  },
  settings: {
    fuzzyMatch: boolean,        // 启用模糊匹配
    caseInsensitive: boolean    // 忽略大小写
  },
  editingScene: Scene | null,   // 当前编辑中的场景
  editingPresetId: string | null, // 当前编辑的预设 ID
  viewMode: 'flat' | 'grouped',  // 泳道视图模式
  expandedGroups: Set<string>,    // 已展开的分组名称
  history: HistoryEntry[]         // 历史记录（最多 5 条）
}
```

#### 3.5.3 初始化流程

```
DOMContentLoaded
    │
    ▼
  init()
    ├── loadSettings()           ← chrome.storage.sync.get
    ├── checkPerfettoTab()
    │   ├── 查询当前活动标签
    │   ├── URL 包含 ui.perfetto.dev?
    │   │   ├── 是 → 发送 PING → 连接成功 → loadTracks()
    │   │   │                    → 连接失败 → 1s 后重试
    │   │   └── 否 → 显示未连接警告
    │   └── 更新状态指示器
    ├── setupEventListeners()     ← 绑定所有 UI 事件
    ├── setupKeyboardShortcuts()  ← 绑定快捷键
    ├── renderPresetScenes()      ← 渲染预设场景
    ├── renderCustomScenes()      ← 渲染自定义场景
    └── renderHistory()           ← 渲染历史记录
```

---

## 4. 通信架构

### 4.1 消息协议

**Popup → Bridge（chrome.runtime）**:

```javascript
{
  command: string,     // 命令名称
  tracks?: string[],   // 泳道名称列表
  pattern?: string,    // 搜索模式
  fuzzy?: boolean      // 模糊匹配开关
}
```

**Bridge → Content（window.postMessage）**:

```javascript
{
  type: 'PERFETTO_AUTO_PIN_COMMAND',
  command: string,
  payload: Object,     // 原始请求数据
  messageId: string    // 请求唯一标识
}
```

**Content → Bridge（window.postMessage）**:

```javascript
{
  type: 'PERFETTO_AUTO_PIN_RESPONSE',
  command: string,
  messageId: string,   // 匹配请求标识
  data: Object         // 响应数据
}
```

### 4.2 完整通信时序图

```
  Popup            Bridge(ISOLATED)      Content(MAIN)      Perfetto API
    │                    │                     │                  │
    │  sendMessage()     │                     │                  │
    ├───────────────────▶│                     │                  │
    │                    │  postMessage()       │                  │
    │                    ├────────────────────▶│                  │
    │                    │                     │  window.app.*    │
    │                    │                     ├─────────────────▶│
    │                    │                     │◀─────────────────┤
    │                    │  postMessage()       │                  │
    │                    │◀────────────────────┤                  │
    │  sendResponse()    │                     │                  │
    │◀───────────────────┤                     │                  │
    │                    │                     │                  │
```

---

## 5. 数据模型

### 5.1 核心数据结构

```
┌─────────────────────────────────────────────────────────┐
│                       数据模型                           │
│                                                         │
│  Scene（场景）                                           │
│  ├── id: string           // 唯一标识                    │
│  ├── name: string         // 场景名称                    │
│  ├── icon: string         // 图标（emoji）               │
│  ├── tracks: string[]     // 泳道名称/模式列表            │
│  └── description?: string // 描述说明                    │
│                                                         │
│  Track（泳道）                                           │
│  ├── name: string         // 泳道名称                    │
│  ├── uri: string          // 泳道 URI                    │
│  ├── pinned: boolean      // 是否已 Pin                  │
│  ├── hasChildren: boolean // 是否有子泳道                 │
│  └── collapsed?: boolean  // 是否折叠                    │
│                                                         │
│  HistoryEntry（历史记录）                                  │
│  ├── id: string           // 唯一标识                    │
│  ├── name: string         // 场景名称                    │
│  ├── icon: string         // 图标                       │
│  ├── tracks: string[]     // 泳道列表                    │
│  └── timestamp: number    // 时间戳                      │
│                                                         │
│  PinResult（Pin 操作结果）                                │
│  ├── success: string[]     // 成功 Pin 的泳道             │
│  ├── notFound: string[]    // 未找到的模式                │
│  └── alreadyPinned: string[] // 已经 Pin 的泳道          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 持久化存储设计

使用 `chrome.storage.sync` 实现跨设备同步持久化。

```
chrome.storage.sync
│
├── customScenes: Scene[]
│   └── 用户创建的自定义场景
│
├── modifiedPresets: { [presetId]: { tracks, icon } }
│   └── 用户对内置预设的修改覆盖
│
├── settings: { fuzzyMatch, caseInsensitive }
│   └── 匹配相关设置
│
└── history: HistoryEntry[]
    └── 最近 Pin 操作历史（最多 5 条）
```

**导出/导入格式**:

```json
{
  "version": "1.0.0",
  "customScenes": [...],
  "modifiedPresets": {...},
  "settings": {...},
  "history": [...],
  "exportedAt": "2026-03-12T..."
}
```

---

## 6. 模式匹配引擎

模式匹配是本扩展的核心功能，支持多层级匹配策略。

### 6.1 匹配优先级

```
matchesPattern(name, pattern, fuzzy)
│
├── 1. 精确匹配          name === pattern
├── 2. 大小写不敏感      name.lower() === pattern.lower()
├── 3. 包含匹配          name.lower().includes(pattern.lower())
├── 4. 通配符匹配        pattern 含 * → 转正则 → regex.test(name)
│       * → .*          例: "Binder:*" → /^Binder:.*$/i
└── 5. 前缀匹配          name.lower().startsWith(pattern.lower())
```

### 6.2 通配符转正则

```
输入模式            转换后正则                 匹配示例
─────────────────────────────────────────────────────────
vsync-*            /^vsync-.*$/i             VSYNC-app, vsync-sf
Binder:*           /^Binder:.*$/i            Binder:1234
com.android.*      /^com\.android\..*$/i     com.android.systemui
*main*             /^.*main.*$/i             main, RenderThread-main
CPU *              /^CPU .*$/i               CPU 0, CPU 1
```

特殊字符转义规则：`.+?^${}()|[]\` 被转义，仅 `*` 被替换为 `.*`。

### 6.3 泳道搜索过滤（Popup 端）

Popup 中的搜索框也实现了独立的过滤逻辑：

```
filterTracks(tracks, searchTerm)
├── 空搜索词 → 返回全部
├── 含 * → 通配符正则匹配
└── 其他 → 包含匹配（toLowerCase）
```

---

## 7. 泳道分组算法

分组视图中，泳道按以下规则自动分组：

```
groupTracks(tracks)
│
├── 规则 1: 含 "/" → 以第一个 "/" 前的部分为组名
│   例: "com.app/main" → 组名 "com.app"
│
├── 规则 2: URI 含 /process_N → 组名 "Process N"
│   例: uri="/process_1234/..." → 组名 "Process 1234"
│
├── 规则 3: 以 com./android./org. 开头 → 取前 3 段
│   例: "com.android.systemui" → 组名 "com.android.systemui"
│
├── 规则 4: 含 ":" → 以 ":" 前部分为组名
│   例: "Binder:1234" → 组名 "Binder"
│
└── 默认: 组名 "Other"
```

分组后按组名字母排序，组内泳道按名称字母排序。

---

## 8. 预设场景系统

### 8.1 内置预设场景

```
┌──────────────────┬──────┬────────────────────────────────────────────┐
│ 场景 ID           │ 图标 │ 包含泳道                                    │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ frame-analysis   │ 🎬   │ Choreographer#doFrame, DrawFrame,          │
│                  │      │ RenderThread, GPU completion, VSYNC-app,   │
│                  │      │ VSYNC-sf, main, Actual/Expected Timeline   │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ startup-analysis │ 🚀   │ main, bindApplication, activityStart,      │
│                  │      │ activityResume, Binder:*, ActivityManager, │
│                  │      │ ActivityTaskManager, reportFullyDrawn      │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ input-analysis   │ 👆   │ main, InputDispatcher, InputReader,        │
│                  │      │ RenderThread, deliverInputEvent,           │
│                  │      │ dispatchTouchEvent, TouchLatency           │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ memory-analysis  │ 💾   │ HeapTaskDaemon, FinalizerDaemon, GC*,     │
│                  │      │ main, mem.*, RSS:*                         │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ binder-analysis  │ 🔗   │ main, Binder:*, binder transaction,       │
│                  │      │ binder reply                               │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ sysui-analysis   │ 📱   │ systemui, Actual/Expected Timeline,        │
│                  │      │ IKeyguardService, Transition:*, UI Events  │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ surfaceflinger   │ 🖼️  │ surfaceflinger, VSYNC-sf, VSYNC-app,      │
│                  │      │ GPU completion, HWC release, HW_VSYNC*    │
├──────────────────┼──────┼────────────────────────────────────────────┤
│ cpu-analysis     │ ⚡   │ CPU *, sched_*, Runnable, Running, freq    │
└──────────────────┴──────┴────────────────────────────────────────────┘
```

### 8.2 预设覆盖机制

```
getEffectivePreset(presetId)
│
├── 查找默认预设 DEFAULT_PRESETS[presetId]
├── 检查 modifiedPresets[presetId] 是否存在
│   ├── 存在 → 合并覆盖 tracks/icon，标记 _isModified: true
│   └── 不存在 → 返回默认预设，标记 _isModified: false
│
└── 恢复默认: delete modifiedPresets[presetId]
```

---

## 9. 历史记录系统

```
addToHistory(scene)
│
├── 创建 HistoryEntry: { id, name, icon, tracks, timestamp }
├── 去重: 比较 tracks 数组（排序后 JSON.stringify）
├── 插入到列表头部
├── 截断至 MAX_HISTORY_ENTRIES (5)
├── 持久化 saveSettings()
└── 重新渲染 renderHistory()
```

**时间格式化**:

| 时间差 | 显示 |
|--------|------|
| < 1 分钟 | "刚刚" |
| < 1 小时 | "N 分钟前" |
| < 1 天 | "N 小时前" |
| >= 1 天 | "N 天前" |

---

## 10. 键盘快捷键系统

### 10.1 全局快捷键（Chrome 级别）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + Shift + P` | 打开扩展 Popup |

### 10.2 Popup 内快捷键

| 快捷键 | 条件 | 功能 |
|--------|------|------|
| `Ctrl/Cmd + Enter` | 有选中泳道 | Pin 选中泳道 |
| `Ctrl/Cmd + A` | 泳道选择 Tab 激活 | 全选泳道 |
| `Escape` | Modal 打开 | 关闭 Modal |
| `1-9` | 非输入框聚焦 | 快速应用对应预设场景 |

---

## 11. Perfetto API 集成

### 11.1 API 接入点

```
window.app                         ← Perfetto 全局应用对象
├── trace                          ← 当前 trace 上下文
│   └── workspaces
│       └── currentWorkspace       ← 当前工作区
│           ├── flatTracks         ← 所有泳道（扁平列表）
│           │   └── TrackNode[]
│           │       ├── name       ← 泳道名称
│           │       ├── uri        ← 泳道唯一标识
│           │       ├── isPinned   ← 是否已 Pin
│           │       ├── hasChildren← 是否有子节点
│           │       ├── collapsed  ← 是否折叠
│           │       ├── pin()      ← Pin 操作
│           │       ├── unpin()    ← Unpin 操作
│           │       └── expand()   ← 展开操作
│           └── pinnedTracks       ← 已 Pin 泳道列表
│
window.raf                         ← Perfetto 渲染调度器
└── scheduleFullRedraw()           ← 触发完整重绘
```

### 11.2 API 兼容性处理

项目对 Perfetto API 的新旧版本做了兼容处理：

```javascript
// flatTracks: 新版为方法，旧版为属性
const flatTracks = typeof workspace.flatTracks === 'function'
  ? workspace.flatTracks()
  : (workspace.flatTracks || []);

// pinnedTracks: 同上
const pinnedTracks = typeof workspace.pinnedTracks === 'function'
  ? workspace.pinnedTracks()
  : (workspace.pinnedTracks || []);
```

---

## 12. 安全模型

### 12.1 权限最小化

```
┌─────────────────────────────────────────────────────────────┐
│                       权限设计                               │
│                                                             │
│  permissions:                                               │
│  ├── storage         仅用于持久化用户配置                     │
│  ├── activeTab       仅用于获取当前标签信息                   │
│  └── scripting       仅用于脚本注入                          │
│                                                             │
│  host_permissions:                                          │
│  └── https://ui.perfetto.dev/*    仅限 Perfetto UI 域名     │
│                                                             │
│  content_scripts 仅匹配:                                    │
│  └── https://ui.perfetto.dev/*                              │
│                                                             │
│  web_accessible_resources 仅匹配:                           │
│  └── https://ui.perfetto.dev/*                              │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 跨世界通信安全

- Bridge 脚本通过 `event.source !== window` 过滤非本页面消息
- 消息类型通过 `type` 字段严格区分：`PERFETTO_AUTO_PIN_COMMAND` / `PERFETTO_AUTO_PIN_RESPONSE`
- 10 秒超时自动清理未响应的监听器，防止内存泄漏
- HTML 转义（`escapeHtml`）防止 XSS 注入

---

## 13. 国际化 (i18n)

```
_locales/
├── en/messages.json       ← 英文（默认）
│   ├── extName: "Perfetto Auto-Pin"
│   └── extDescription: "One-click pin tracks..."
│
└── zh_CN/messages.json    ← 简体中文
    ├── extName: "Perfetto Auto-Pin"
    └── extDescription: "一键 Pin 泳道到 Perfetto UI..."
```

manifest.json 中使用 `__MSG_extName__` 和 `__MSG_extDescription__` 引用国际化字符串。Popup UI 内的文字目前硬编码为中文。

---

## 14. UI 设计系统

### 14.1 设计变量

```css
:root {
  --primary-color:   #1a73e8   /* Google Blue */
  --primary-hover:   #1557b0
  --secondary-color: #5f6368
  --background:      #ffffff
  --surface:         #f8f9fa
  --border:          #dadce0
  --text-primary:    #202124
  --text-secondary:  #5f6368
  --success:         #34a853   /* Google Green */
  --warning:         #fbbc04   /* Google Yellow */
  --error:           #ea4335   /* Google Red */
  --radius:          8px
  --shadow:          0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)
}
```

采用 Google Material Design 色彩体系，与 Perfetto UI 风格保持一致。

### 14.2 响应式布局

- 弹出窗口宽度范围：380px ~ 450px
- 泳道列表最大高度：300px（内部滚动）
- 自定义滚动条样式（6px 宽度）

### 14.3 Toast 通知系统

```
Toast 类型:
├── info    → 深灰背景
├── success → 绿色背景
├── warning → 黄色背景
└── error   → 红色背景

动画: fadeInUp 0.3s
自动消失: 3 秒后
单例模式: 新 Toast 移除旧 Toast
```

### 14.4 Content Script 注入样式

注入 Perfetto 页面的样式，提供视觉反馈：

- `.perfetto-auto-pin-highlight`: Pin 操作后的蓝色边框脉冲动画
- `.perfetto-auto-pin-toast`: 页面内 Toast 通知

---

## 15. 项目目录结构

```
Perfetto-Auto-Pin/
│
├── manifest.json                 # Chrome 扩展清单（Manifest V3）
│
├── src/
│   ├── popup.html                # 弹出窗口 HTML 骨架
│   ├── popup.css                 # 弹出窗口样式（Material Design 风格）
│   ├── popup.js                  # 弹出窗口逻辑（IIFE，~1200 行）
│   │   ├── DEFAULT_PRESETS       #   - 8 个内置场景定义
│   │   ├── state                 #   - 应用状态对象
│   │   ├── elements              #   - DOM 元素引用缓存
│   │   ├── init()                #   - 初始化入口
│   │   └── ...                   #   - 场景/泳道/历史/设置管理
│   │
│   ├── bridge.js                 # 通信桥（ISOLATED world）
│   │   ├── injectContentScript() #   - 动态注入 content.js
│   │   └── 消息转发               #   - chrome.runtime ↔ postMessage
│   │
│   ├── content.js                # 内容脚本（MAIN world）
│   │   ├── PerfettoTrackManager  #   - Perfetto API 封装类
│   │   └── 命令处理器              #   - 7 种命令的消息处理
│   │
│   ├── content.css               # 注入 Perfetto 页面的样式
│   └── background.js             # Service Worker
│
├── icons/
│   └── icon.svg                  # 扩展图标源文件
│
├── _locales/
│   ├── en/messages.json          # 英文本地化
│   └── zh_CN/messages.json       # 中文本地化
│
├── tools/
│   ├── generate_icons.py         # Python 图标生成脚本
│   └── generate-icons.html       # 浏览器端图标生成工具
│
└── store/
    ├── STORE_LISTING.md          # Chrome Web Store 上架文案
    └── PRIVACY_POLICY.md         # 隐私政策
```

---

## 16. 技术决策摘要

| 决策 | 选择 | 理由 |
|------|------|------|
| 扩展协议 | Manifest V3 | Chrome 最新标准，必选 |
| 构建工具 | 无（原生 JS） | 扩展体量小，避免构建复杂度 |
| API 访问方式 | Bridge + postMessage | 唯一能从 ISOLATED world 访问 MAIN world 变量的方式 |
| 状态管理 | 闭包内全局对象 | IIFE 封装，无外部依赖 |
| 持久化 | chrome.storage.sync | 跨设备同步，容量够用 |
| 样式方案 | 原生 CSS + CSS Variables | 轻量，无预处理器依赖 |
| 匹配算法 | 多级 fallback | 兼顾精确性和便利性 |
| Perfetto API 兼容 | 方法/属性双检测 | 适配不同版本 Perfetto |

---

## 17. 数据流图

### 17.1 场景应用流程

```
用户点击"应用场景"
        │
        ▼
  applyScene(scene)
        │
        ├── showToast("正在应用...")
        │
        ▼
  sendMessage({ command: 'PIN_TRACKS', tracks: [...] })
        │
        ▼
  chrome.tabs.sendMessage ──▶ bridge.js
        │                         │
        │                         ▼
        │                    window.postMessage
        │                         │
        │                         ▼
        │                    content.js: pinTracksByPatterns()
        │                         │
        │                         ├── 遍历每个 pattern
        │                         │   ├── 遍历 allTracks
        │                         │   ├── matchesPattern()
        │                         │   └── trackNode.pin()
        │                         │
        │                         ├── triggerRefresh()
        │                         │
        │                         ▼
        │                    返回 {success, notFound, alreadyPinned}
        │                         │
        │                         ▼
        │                    window.postMessage (响应)
        │                         │
        ▼                         ▼
  bridge.js ──▶ sendResponse ──▶ popup.js
        │
        ├── addToHistory(scene)    ← 记录历史
        ├── showToast(结果摘要)     ← 显示结果
        └── loadTracks()           ← 刷新泳道列表
```

### 17.2 配置导入导出流程

```
导出:                                导入:
saveSettings()                      importConfig(file)
    │                                   │
    ▼                                   ▼
chrome.storage.sync.set             FileReader.readAsText
    │                                   │
    ▼                                   ▼
exportConfig()                      JSON.parse
    │                                   │
    ▼                                   ▼
JSON.stringify(config)              合并到 state
    │                                   │
    ▼                                   ▼
Blob → URL → <a>.click()           saveSettings()
    │                                   │
    ▼                                   ▼
下载 .json 文件                     重新渲染 UI
```

---

## 18. 未来扩展方向

| 方向 | 描述 | 复杂度 |
|------|------|--------|
| Perfetto 命令面板集成 | 将场景注册到 Perfetto 的命令面板中 | 高 |
| 云端配置同步 | 通过后端服务实现团队配置共享 | 高 |
| 智能进程检测 | 自动识别当前 trace 的应用进程并推荐场景 | 中 |
| 自定义快捷键 | 允许用户自定义快捷键绑定 | 低 |
| 深色模式 | 跟随系统/Perfetto 主题切换 | 低 |
| 泳道依赖分析 | 可视化泳道间的因果关系 | 高 |
