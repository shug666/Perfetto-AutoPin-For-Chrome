## Why

`popup.js` 中 `addToHistory()` 函数在去重比较时使用了 `Array.sort()` 原地排序。由于 `entry.tracks = scene.tracks` 是引用赋值而非拷贝，`.sort()` 直接修改了原始场景的 tracks 数组，导致自定义场景和预设场景的泳道顺序被排成字母序并持久化到 storage。

此外，为防止 Perfetto 内部可能的排序行为，新增了在 pin 操作后直接操作 workspace 树结构强制排序的能力。

## What Changes

- **修复 `addToHistory` 中的 `.sort()` 原地排序 bug**：使用 `[...array].sort()` 创建副本后排序，避免修改原始 scene.tracks 数组；同时 `entry.tracks` 使用 `[...scene.tracks]` 拷贝而非引用
- **新增 `reorderPinnedTracks` 方法**：在所有 pin 操作完成后，通过访问 Perfetto workspace 的 pinned tracks 容器节点，移除并按用户定义顺序重新添加子节点，作为额外保障
- **修改 `pinTracksByPatterns` 方法**：在 pin 操作完成后调用 `reorderPinnedTracks` 强制排列顺序

## Capabilities

### New Capabilities

- `fix-sort-mutation`: 修复 addToHistory 中 .sort() 原地排序导致的场景数据变异
- `force-pinned-order`: 在 pin 操作完成后通过直接操作 Perfetto 内部树结构强制 pinned tracks 排列顺序

### Modified Capabilities


## Impact

- `src/popup.js`：修改 `addToHistory()` 函数中的数组赋值和排序逻辑
- `src/content.js`：新增 `reorderPinnedTracks()` 方法，修改 `pinTracksByPatterns()` 方法
