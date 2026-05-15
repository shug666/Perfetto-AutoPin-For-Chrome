## 1. 核心 Overlay 引擎（content.js）

- [x] 1.1 在 `PerfettoTrackManager` 中新增 `DurationOverlayManager` 类，负责管理 overlay 容器 DOM 元素的创建、定位和生命周期
- [x] 1.2 实现 `initOverlayContainer()` 方法：使用 `position: fixed` 将 overlay 容器挂载到 `document.body`，通过 canvas 元素的 `getBoundingClientRect()` 动态定位到 TimeSelectionPanel 区域（偏移 22px 跳过 TimeAxisPanel），z-index 设为 9999
- [x] 1.3 实现 `getSpanNotes()` 方法：从 `trace.notes.notes` Map 中过滤出所有 `noteType === 'SPAN'` 且 `id !== '__temp__'` 的 SpanNote
- [x] 1.4 实现 `formatDuration(durationNs)` 工具函数：根据数值量级自动选择 ns / µs / ms / s 单位，保留最多 2 位小数
- [x] 1.5 实现 `timeToPx(time, visibleWindow, trackContentWidth)` 坐标转换函数：使用 BigInt 算术计算时间点对应的像素 X 坐标

## 2. 视窗同步与渲染循环

- [x] 2.1 实现 `startRenderLoop()` 方法：使用 `requestAnimationFrame` 启动渲染循环，在每帧检测 `visibleWindow` 和 `notes` 变化
- [x] 2.2 实现变化检测逻辑：缓存上一帧的 `visibleWindow.start/end` 和 `notes` Map 的 size + 内容，仅在变化时触发 DOM 更新
- [x] 2.3 实现 `renderOverlays()` 方法：遍历所有可见 SpanNote，为每个创建/更新对应的 DOM 元素（H-bar 样式的时长标签），隐藏不可见的标签。使用 canvas 元素 `getBoundingClientRect()` 精确获取内容区域坐标
- [x] 2.4 实现 DOM 元素复用池：维护已创建标签元素的 Map（key 为 note.id），避免每帧创建/销毁 DOM 节点
- [x] 2.5 实现 `stopRenderLoop()` 方法：取消 rAF 循环并移除所有 overlay DOM 元素

## 3. 样式实现（content.css）

- [x] 3.1 新增 `.perfetto-duration-overlay-container` 样式：`position: fixed`、`pointer-events: none`、`z-index: 9999`、`overflow: visible`、高度 10px
- [x] 3.2 新增 `.perfetto-duration-label` 样式：H-bar 视觉效果（水平线 + 两端垂直线）、半透明白色背景、紧凑字体（10px Roboto Condensed）、居中文本、`will-change: transform` GPU 优化
- [x] 3.3 新增 `.perfetto-duration-label-text` 样式：文本居中、白色半透明背景遮罩（rgba 255,255,255,0.85）、与 Perfetto 原生 `COLOR_TEXT_MUTED` 一致的文字颜色（#5f6368）

## 4. 消息通信扩展（bridge.js + content.js）

- [x] 4.1 在 content.js 的消息处理 switch 中新增 `TOGGLE_DURATION_OVERLAY` 命令：接收 `{ enabled: boolean }` 参数，调用 `DurationOverlayManager` 的 start/stop 方法
- [x] 4.2 在 content.js 的消息处理 switch 中新增 `GET_DURATION_OVERLAY_STATUS` 命令：返回 overlay 当前状态（enabled、noteCount）
- [x] 4.3 在 bridge.js 中确保新命令的消息转发正常工作（无需额外代码，现有通用转发机制已覆盖）

## 5. Popup 设置集成

- [x] 5.1 在 popup.html 的设置 Tab 中新增"标注增强"区域，包含"持久化时长显示 (Shift+M 标注)"开关控件（checkbox），默认开启
- [x] 5.2 在 popup.js 中新增 `persistDuration` 设置项：从 `chrome.storage.sync` 读取/写入，默认值为 `true`
- [x] 5.3 在 popup.js 中实现开关事件处理：切换时通过 bridge 发送 `TOGGLE_DURATION_OVERLAY` 命令到 content script
- [x] 5.4 在 popup.js 的 `checkPerfettoTab()` 成功连接后，根据 `persistDuration` 设置自动发送初始化命令到 content script

## 6. 初始化与生命周期

- [x] 6.1 在 content.js 的 `PerfettoTrackManager.init()` 完成后，自动检查存储设置并按需启动 `DurationOverlayManager`（MAIN world 无法访问 chrome.storage，默认启动）
- [x] 6.2 实现 Perfetto API 可用性检测：在启动 overlay 前验证 `trace.notes` 和 `trace.timeline.visibleWindow` 是否存在，不存在则静默降级并在控制台输出警告
- [x] 6.3 处理 Perfetto 页面 trace 切换/重新加载：在 rAF 循环中检测 `trace` 对象引用变化，在 trace 切换时清空现有标签并重新初始化

## 7. 测试与验证

- [x] 7.1 在 Perfetto UI 上加载 trace，使用 Shift+M 创建多个 SpanNote，验证时长标签持久显示
- [x] 7.2 缩放和平移 timeline，验证时长标签位置实时同步（已通过 canvas getBoundingClientRect 精确对齐）
- [x] 7.3 删除 SpanNote，验证对应时长标签被移除
- [x] 7.4 在 Popup 中切换"持久化时长显示"开关，验证 overlay 的显示/隐藏
- [x] 7.5 验证 `M` 键创建的临时 Note（__temp__）不会触发持久时长标签
