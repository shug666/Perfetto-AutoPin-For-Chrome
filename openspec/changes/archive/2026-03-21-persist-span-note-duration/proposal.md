## Why

Perfetto 的 "Shift+M" 快捷键可以为当前选区创建永久 SpanNote（区间标注），在 Notes Panel 上显示标记三角形和连线。然而，SpanNote 的时长信息（H-bar 持续时间标签）仅在该 Note 被选中时才显示在 TimeSelectionPanel 上——一旦用户点击其他元素或切换选区，时长信息立即消失。这对于需要同时查看多个标注区间时长的性能分析场景（如对比多个帧的渲染耗时）极为不便，用户不得不反复点击 Note 来查看时长。

## What Changes

- **新增持久化时长展示层**: 在 content.js 中注入一个持久化 DOM overlay 层，用于显示所有 SpanNote 的时长信息
- **SpanNote 监控机制**: 通过轮询 Perfetto 的 `trace.notes.notes` API 实时检测 SpanNote 的增删变化
- **视窗同步渲染**: 监听 Perfetto 的 timeline visibleWindow 变化，动态计算每个 SpanNote 的像素位置并更新 overlay 中时长标签的位置
- **样式与交互**: 时长标签采用与 Perfetto 原生一致的视觉风格，支持半透明背景防止遮挡 trace 内容，并提供整体开关控制
- **Popup 集成**: 在扩展 Popup 中增加"持久化时长显示"的开关选项

## Capabilities

### New Capabilities
- `persist-duration-overlay`: 为 Perfetto 页面上所有 SpanNote 提供持久化的时长信息展示层，包括 DOM overlay 渲染、视窗同步、Note 变更监听、样式定制和开关控制

### Modified Capabilities
（无已有 spec 需要修改）

## Impact

- **受影响代码**:
  - `input/source/src/content.js` — 新增 `DurationOverlayManager` 类（~300 行），SpanNote 监控和 overlay 渲染逻辑
  - `input/source/src/content.css` — 新增 overlay 相关样式（固定定位容器、H-bar 标签）
  - `input/source/src/popup.js` — 新增 `persistDuration` 设置项及开关事件处理
  - `input/source/src/popup.html` — 新增"标注增强"设置区域及开关控件
  - `input/source/src/popup.css` — 新增 `.setting-desc` 辅助样式
  - `input/source/src/bridge.js` — 无需修改（现有通用消息转发机制已覆盖新命令）
- **Perfetto API 依赖**:
  - `window.app.trace.notes.notes` — 读取所有 Note（包括 SpanNote）
  - `window.app.trace.timeline.visibleWindow` — 获取当前可见时间窗口用于坐标计算
  - `window.raf.scheduleFullRedraw` — 触发 Perfetto UI 重绘
- **无外部依赖变更**: 不引入新的第三方库
- **存储影响**: 在 chrome.storage.sync 的 settings 中新增 `persistDuration` 布尔字段
