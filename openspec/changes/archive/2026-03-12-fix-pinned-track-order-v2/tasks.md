## 1. 修复 addToHistory 的 .sort() 原地排序 bug

- [x] 1.1 修改 `popup.js` 中 `addToHistory()` 的 `entry.tracks` 赋值：从 `scene.tracks`（引用）改为 `[...scene.tracks]`（拷贝）
- [x] 1.2 修改去重比较中的排序：从 `h.tracks.sort()` / `entry.tracks.sort()` 改为 `[...h.tracks].sort()` / `[...entry.tracks].sort()`，避免原地排序修改原数组

## 2. 新增 reorderPinnedTracks 方法（额外保障）

- [x] 2.1 在 `content.js` 的 `PerfettoTrackManager` 类中新增 `reorderPinnedTracks(desiredNameOrder)` 方法
- [x] 2.2 通过 `pinnedTracks[0].parent` 找到容器节点，检查 `removeChild` / `addChildLast` API 可用性
- [x] 2.3 场景泳道按 `desiredNameOrder` 排前，其他已 pin 泳道保持原有顺序排后
- [x] 2.4 移除容器子节点后按目标顺序重新添加

## 3. 集成到 pinTracksByPatterns

- [x] 3.1 在 Phase 2b 完成后、`triggerRefresh()` 前调用 `reorderPinnedTracks(orderedMatches.map(t => t.name))`

## 4. 验证

- [x] 4.1 代码审查：确认 addToHistory 不再修改原始场景数据
- [x] 4.2 代码审查：确认 reorderPinnedTracks 对 API 不可用情况的降级处理正确
