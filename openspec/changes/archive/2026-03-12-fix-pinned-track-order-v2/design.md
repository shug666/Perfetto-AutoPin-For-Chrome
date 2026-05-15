## Context

用户报告：自定义场景中配置的泳道顺序在使用一次后变成字母序。

**根因定位**：`popup.js` 中 `addToHistory()` 函数在去重比较时使用了 `Array.sort()`，这是一个原地排序操作。由于 `entry.tracks = scene.tracks` 是引用赋值（指向同一数组对象），`.sort()` 直接修改了原始场景的 tracks 数组。随后 `saveSettings()` 将排序后的数据持久化到 `chrome.storage.sync`，导致自定义场景和预设修改的泳道顺序永久被打乱。

**影响范围**：
- 自定义场景（`state.customScenes[i].tracks`）
- 用户修改过的预设场景（`state.modifiedPresets[id].tracks`）
- 历史记录中的泳道列表（`state.history[i].tracks`）
- 默认预设的内存副本（`DEFAULT_PRESETS[i].tracks`）

**上一版修复**（v1）的局限：v1 修复了 `pinTracksByPatterns` 的调用顺序，但真正的根因在 popup.js 侧的 `addToHistory()` 中，不在 content.js 中。

## Goals / Non-Goals

**Goals:**

- 修复 `addToHistory()` 中 `.sort()` 原地排序导致的数组变异 bug
- 确保场景的 tracks 数组在任何操作后都不被修改
- 新增 Perfetto 内部树结构重排能力，作为额外保障

**Non-Goals:**

- 不修改 Perfetto 源码
- 不改变场景数据的存储格式

## Decisions

### 决策 1：使用 spread 拷贝替代引用赋值

**选择**：
- `entry.tracks = [...scene.tracks]`（拷贝赋值）替代 `entry.tracks = scene.tracks`（引用赋值）
- `[...h.tracks].sort()` 替代 `h.tracks.sort()`，确保 `.sort()` 作用在副本上

**替代方案**：
- A) 使用 `Array.from()` 或 `slice()` → 功能等效但 spread 更简洁
- B) 使用 `structuredClone()` → 过度设计，tracks 只是字符串数组

**理由**：最小改动，精确修复 bug，无副作用。

### 决策 2：新增 reorderPinnedTracks 防御性方法

**选择**：在 `content.js` 中新增 `reorderPinnedTracks(desiredNameOrder)` 方法，在 pin 操作完成后直接操作 Perfetto 内部树结构强制排序。

**理由**：作为额外保障，防止 Perfetto 内部可能的排序行为。通过 `parent` 属性反向查找容器节点，使用 `removeChild` + `addChildLast` 重排子节点。API 不可用时降级。

## Risks / Trade-offs

- **[已持久化的乱序数据]** → 用户已保存到 storage 的被打乱顺序不会自动恢复 → Mitigation: 用户需手动编辑场景重新排序，或重新导入配置
- **[reorderPinnedTracks API 兼容性]** → `parent`/`removeChild`/`addChildLast` 可能在某些 Perfetto 版本不存在 → Mitigation: 每个 API 调用前 typeof 检查，不可用时降级
