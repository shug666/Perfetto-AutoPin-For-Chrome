## Why

场景应用后 Perfetto 中 Pin 的泳道顺序与场景定义顺序不一致，导致用户精心排列的分析顺序被打乱。同时，泳道选择 Tab 中已 Pin 泳道未默认勾选，用户需手动逐个勾选后才能保存为场景，操作效率低下。

## What Changes

- **修复泳道 Pin 顺序**：调整 `pinTracksByPatterns` 逻辑，按场景中定义的 tracks 数组顺序依次 Pin 泳道，而非按 Perfetto `flatTracks` 的遍历顺序。确保 Pin 后的泳道在 Perfetto UI 中的排列与用户定义的场景顺序完全一致。
- **已 Pin 泳道默认勾选**：在泳道选择 Tab 加载泳道列表时，自动将状态为 `pinned` 的泳道加入 `selectedTracks` 集合并在 UI 中默认勾选，方便用户直接保存为场景或快速操作。

## Capabilities

### New Capabilities

- `ordered-pin`: 确保泳道按场景定义顺序 Pin 到 Perfetto UI，而非按 Perfetto 内部遍历顺序
- `auto-select-pinned`: 加载泳道列表时自动选中已 Pin 泳道

### Modified Capabilities


## Impact

- `src/content.js`：修改 `PerfettoTrackManager.pinTracksByPatterns()` 方法的遍历和 Pin 执行逻辑
- `src/popup.js`：修改 `loadTracks()` 方法，在获取泳道列表后自动选中已 Pin 泳道
