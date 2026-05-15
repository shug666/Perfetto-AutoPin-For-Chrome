## Context

Perfetto Auto-Pin 扩展在执行场景 Pin 操作时存在两个交互问题：

1. **泳道顺序丢失**：`pinTracksByPatterns()` 按 pattern 顺序遍历，但对于已经 Pin 的泳道会跳过（归入 `alreadyPinned`）。当用户第二次应用同一场景时，先前 Pin 的泳道保留在原位而新 Pin 的泳道追加到末尾，导致 Pin 区域的泳道顺序与场景定义不一致。此外，Perfetto 的 `track.pin()` API 每次将泳道添加到 pinned 列表末尾，多次混合 pin/unpin 操作会进一步打乱顺序。

2. **已 Pin 泳道未默认选中**：`loadTracks()` 获取泳道后直接渲染列表，不会根据泳道的 `pinned` 状态自动更新 `state.selectedTracks`，用户需手动勾选已 Pin 泳道才能保存为场景。

## Goals / Non-Goals

**Goals:**

- 确保每次应用场景后 Perfetto Pin 区域的泳道顺序与场景 `tracks` 数组顺序严格一致
- 泳道选择 Tab 加载泳道列表时，自动将 `pinned: true` 的泳道纳入选中集合

**Non-Goals:**

- 不修改 Perfetto 内部 API 的行为
- 不改变历史记录的存储格式
- 不改变用户已有的自定义场景数据

## Decisions

### 决策 1：先 Unpin 再按序 Pin

**选择**：在 `pinTracksByPatterns()` 中，先收集所有匹配泳道（按 pattern 顺序），然后 unpin 这些泳道中已 pin 的，最后按序 pin 全部匹配泳道。

**替代方案**：
- A) 仅跳过已 pin 泳道（当前行为）→ 无法解决顺序问题
- B) 每次先 unpin 全部泳道再 pin → 过于激进，会影响用户手动 pin 的其他泳道

**理由**：方案 B 会破坏用户手动 pin 的泳道状态，方案 A 无法解决问题。选择的方案只影响当前场景涉及的泳道，最小化副作用。

### 决策 2：收集阶段与执行阶段分离

**选择**：分两阶段执行：
1. 收集阶段：遍历所有 pattern，按 pattern 顺序收集匹配的 TrackNode（去重）
2. 执行阶段：先 unpin 已 pin 的匹配泳道，再按收集顺序依次 pin

**理由**：分离收集与执行确保顺序确定性，也便于准确报告 `notFound` 结果。

### 决策 3：在 loadTracks 后同步选中已 Pin 泳道

**选择**：在 `loadTracks()` 的 `response.tracks` 返回后、`renderTrackList()` 调用前，遍历泳道列表将 `pinned: true` 的泳道名称加入 `state.selectedTracks`。

**替代方案**：
- 在 `renderTrackList()` 内部处理 → 职责不清，渲染不应修改状态

**理由**：保持状态管理（loadTracks）和视图渲染（renderTrackList）的职责分离。

## Risks / Trade-offs

- **[Unpin-repin 闪烁]** → 整个操作在单次 JS 执行中完成，Perfetto 在 `triggerRefresh()` 前不会重绘，因此用户无感知
- **[已 pin 泳道与手动选中冲突]** → `loadTracks` 是重新加载操作，重置选中状态是合理行为；后续手动勾选/取消不受影响
- **[Perfetto API 版本兼容]** → pin/unpin 操作已有兼容性检查（`typeof trackNode.pin === 'function'`），本次改动不引入新 API 调用
