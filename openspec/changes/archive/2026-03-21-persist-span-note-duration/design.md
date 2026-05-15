## Context

Perfetto Auto-Pin 是一款 Chrome 扩展，通过注入 content script（MAIN world）直接调用 Perfetto 内部 API（`window.app`）来实现泳道自动 Pin 功能。当前扩展只操作 track 层面，未涉及 Perfetto 的 Notes/SpanNote 系统。

Perfetto 的 `Shift+M` 快捷键会调用 `trace.notes.addSpanNote()` 创建永久 SpanNote，其标记三角形和连线在 NotesPanel 上持久显示。但 SpanNote 的**时长信息**（H-bar 持续时间标签）由 `TimeSelectionPanel` 渲染，仅在对应 Note 被选中时显示——取消选中即消失。

核心技术约束：
- Perfetto 的 timeline 渲染基于 Canvas，外部无法直接修改其绘制逻辑
- 扩展运行在 MAIN world，可完全访问 `window.app` 及其子对象
- 时间到像素的坐标转换需要 `visibleWindow`（可见时间窗口）和页面 track shell 宽度

## Goals / Non-Goals

**Goals:**
- 让所有 SpanNote 的时长信息在 timeline 上持久可见，不随选区变化而消失
- 时长标签跟随视窗缩放和平移实时更新位置
- 视觉风格与 Perfetto 原生时长显示保持一致
- 通过扩展 Popup 的开关控制此功能的启用/禁用
- 不影响 Perfetto 原有的交互行为

**Non-Goals:**
- 不修改 Perfetto 的原生源码，仅通过扩展注入方式实现
- 不重新实现 Perfetto 的 Note 编辑功能（点击、拖拽等交互由原生处理）
- 不支持 DEFAULT 类型 Note（单点标记）的时长显示——它们没有时间跨度
- 不处理 id 为 `__temp__` 的临时 Note（这是 `M` 键创建的临时标注，不是 `Shift+M`）

## Decisions

### Decision 1: Fixed-Position DOM Overlay 而非 Canvas Hook

**选择**: 使用 `position: fixed` 的 DOM 元素覆盖在 Perfetto Canvas 上方显示时长标签，通过 canvas 元素的 `getBoundingClientRect()` 动态定位

**替代方案**:
- **Hook Canvas rendering**: 拦截 `CanvasRenderingContext2D` 方法注入绘制逻辑。侵入性强，Perfetto 内部渲染流程复杂，版本升级极易 break。
- **Absolute-position inside `.pf-timeline-header`**: 将 overlay 插入 Perfetto 内部 DOM。实测发现会被 `VirtualOverlayCanvas` 的 canvas 容器（`position: absolute; inset: 0`）遮挡。
- **MutationObserver + CSS**: 监控 DOM 变化。Perfetto timeline 完全基于 Canvas，DOM 中无对应元素。

**理由**: `position: fixed` + `z-index: 9999` 的 overlay 挂载到 `document.body`，完全独立于 Perfetto 的 DOM 层级，不受内部 stacking context 影响。每帧通过 `canvas.getBoundingClientRect()` 获取 Perfetto 实际 canvas 元素的精确坐标，保证与 canvas 渲染的像素级对齐。

### Decision 2: requestAnimationFrame 轮询同步

**选择**: 使用 `requestAnimationFrame` 循环检测 `visibleWindow` 变化并更新 overlay 位置

**替代方案**:
- **定时器轮询 (setInterval)**: 更简单但无法与渲染帧同步，会导致 overlay 位置与 canvas 内容不一致的"撕裂"现象。
- **Hook timeline 方法**: 尝试包装 `timeline.pan()` / `timeline.zoom()` 等方法。侵入性高，难以覆盖所有触发路径。

**理由**: `requestAnimationFrame` 与浏览器渲染帧精确同步，保证 overlay 与 Canvas 内容在同一帧更新，视觉上无延迟。通过比较上一帧的 `visibleWindow` 状态实现变化检测，避免不必要的 DOM 操作。

### Decision 3: 坐标计算方案

**选择**: 基于 canvas 元素 `getBoundingClientRect()` + BigInt 时间算术实现精确坐标映射

```
canvasRect = headerEl.querySelector('canvas').getBoundingClientRect()
contentLeft = canvasRect.left + shellWidth
contentWidth = canvasRect.width - shellWidth
pixelX = (noteTime - windowStart) * contentWidth / (windowEnd - windowStart)
```

**理由**: Perfetto 的 `TimeScale` 类依赖 `HighPrecisionTimeSpan` 等内部类型无法直接复用。关键发现：不能使用 CSS 变量或 DOM 元素的尺寸推算内容区域宽度——由于 scrollbar gutter、grid 布局、border 等因素，计算值与 canvas 实际渲染宽度存在偏差，导致缩放时标注位置漂移。直接读取 canvas 元素的 BoundingClientRect 是唯一能保证像素级精确的方案。`TRACK_SHELL_WIDTH` 通过 CSS 变量 `--track-shell-width` 读取（默认 100px），用于计算 canvas 内容区域的左边界。

### Decision 4: Note 变更检测

**选择**: 在 rAF 循环中同时检测 `trace.notes.notes` Map 的 size 和内容变化

**理由**: Perfetto 的 `NoteManagerImpl` 内部使用 `Map<string, Note | SpanNote>`，无事件发射。检测 Map size 变化（增/删）成本极低。内容变化检测（start/end/color）通过缓存上一帧的值对比实现。SpanNote 数量通常很少（< 20），遍历开销可忽略。

### Decision 5: 时长格式化

**选择**: 内联实现时长格式化逻辑，根据量级自动选择合适单位（ns / µs / ms / s）

**替代方案**: 尝试调用 Perfetto 内部的 `formatDuration` 函数。该函数位于模块内部，无法从外部直接调用。

**理由**: 时长格式化逻辑简单（数值除法 + 单位切换），内联实现 < 20 行代码，零外部依赖。

## Risks / Trade-offs

- **[Perfetto API 变更]** → `trace.notes.notes` 或 `timeline.visibleWindow` 的 API 签名可能在 Perfetto 版本更新时改变。**缓解**: 添加 API 存在性检测，不可用时静默降级（禁用 overlay）并在控制台警告。
- **[高 Note 数量性能]** → 大量 SpanNote（> 50）时 rAF 循环中的 DOM 操作可能影响帧率。**缓解**: 仅更新可见窗口内的 Note overlay，不可见的设 `display: none`；使用 `transform: translateX()` 代替 `left` 属性以触发 GPU 合成层优化。
- **[CSS 变量不存在]** → `--track-shell-width` 在不同 Perfetto 版本中可能不存在。**缓解**: 提供默认值 100px（Perfetto 当前默认值）。
- **[Z-index 冲突]** → Overlay 层级可能与 Perfetto 的 modal/dialog 冲突。**缓解**: 使用 z-index: 9999，高于 Perfetto 内部 canvas 层级但低于浏览器扩展 popup 层级。实际测试表明需要 > 100 的 z-index 才能覆盖 Perfetto 的 VirtualOverlayCanvas。
- **[时间精度]** → JavaScript Number 精度限制可能在极长 trace（> 2^53 ns ≈ 104 天）中导致坐标偏差。**缓解**: 使用 BigInt 算术进行时间差计算，仅在最终除法时转为 Number。
