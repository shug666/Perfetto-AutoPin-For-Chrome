## ADDED Requirements

### Requirement: 泳道按场景定义顺序 Pin

系统 SHALL 在执行场景 Pin 操作时，严格按照场景 `tracks` 数组中的顺序 Pin 泳道。Pin 完成后，Perfetto 的 pinned 区域中泳道的排列顺序 MUST 与场景定义顺序一致。

#### Scenario: 首次应用场景时保持顺序
- **WHEN** 用户应用一个包含泳道 `["A", "B", "C"]` 的场景，且三个泳道均未被 Pin
- **THEN** Pin 完成后，Perfetto pinned 区域中泳道顺序为 A、B、C

#### Scenario: 重复应用同一场景时保持顺序
- **WHEN** 用户已经应用过包含泳道 `["A", "B", "C"]` 的场景（此时三个泳道均已 Pin），再次应用同一场景
- **THEN** Pin 完成后，泳道顺序依然为 A、B、C

#### Scenario: 部分泳道已 Pin 时保持顺序
- **WHEN** 泳道 B 已被手动 Pin，用户应用包含泳道 `["A", "B", "C"]` 的场景
- **THEN** 系统先 Unpin 已 Pin 的 B，再按序 Pin A、B、C，最终顺序为 A、B、C

#### Scenario: 包含通配符模式的场景保持顺序
- **WHEN** 用户应用包含 `["main", "Binder:*", "RenderThread"]` 的场景，`Binder:*` 匹配到 `Binder:1234` 和 `Binder:5678`
- **THEN** Pin 顺序为 main → Binder:1234 → Binder:5678 → RenderThread（通配符匹配按 Perfetto flatTracks 中的出现顺序排列）

### Requirement: 未匹配的 Pattern 不影响已有 Pin

系统 SHALL 在场景中某些 pattern 未匹配到任何泳道时，不影响其他已成功匹配和 Pin 的泳道顺序。未匹配的 pattern MUST 被记录到返回结果的 `notFound` 数组中。

#### Scenario: 部分 Pattern 无匹配
- **WHEN** 用户应用包含 `["main", "NonExistent", "RenderThread"]` 的场景
- **THEN** main 和 RenderThread 按序被 Pin，`NonExistent` 出现在返回结果的 `notFound` 数组中
