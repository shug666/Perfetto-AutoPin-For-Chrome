## 1. 修复泳道 Pin 顺序（ordered-pin）

- [x] 1.1 重构 `content.js` 中 `pinTracksByPatterns()` 方法：将原有的「遍历 pattern → 遍历 tracks → 立即 pin」逻辑，改为两阶段：第一阶段按 pattern 顺序收集所有匹配的 TrackNode（用 Set 去重保证同一 track 不重复），第二阶段统一执行 unpin 再按序 pin
- [x] 1.2 在第二阶段执行前，先遍历收集到的匹配泳道列表，对其中 `pinned: true` 的泳道调用 `unpinTrackNode()`，将它们从 pinned 区域移除
- [x] 1.3 在 unpin 完成后，按收集到的顺序依次调用 `pinTrackNode()` 对所有匹配泳道执行 pin 操作
- [x] 1.4 确保 `notFound`、`success`、`alreadyPinned` 返回结果的语义正确：`success` 包含所有被 pin 的泳道名称，`alreadyPinned` 不再使用（因为已 pin 泳道会先 unpin 再 repin），`notFound` 包含无任何匹配的 pattern

## 2. 已 Pin 泳道自动选中（auto-select-pinned）

- [x] 2.1 修改 `popup.js` 中 `loadTracks()` 方法：在收到 `response.tracks` 后、调用 `renderTrackList()` 之前，清空 `state.selectedTracks`，然后遍历 tracks 列表，将 `pinned: true` 的泳道名称加入 `state.selectedTracks`
- [x] 2.2 在 `loadTracks()` 末尾调用 `updatePinButtonState()` 确保 Pin 按钮状态与自动选中同步

## 3. 验证

- [x] 3.1 验证场景首次应用后泳道顺序与场景定义一致
- [x] 3.2 验证重复应用同一场景后泳道顺序不变
- [x] 3.3 验证泳道选择 Tab 中已 Pin 泳道默认勾选且选中计数正确
- [x] 3.4 验证刷新泳道列表后自动选中状态与实际 Pin 状态同步
