## ADDED Requirements

### Requirement: addToHistory 不修改原始场景数据

系统 SHALL 在 `addToHistory()` 函数中使用数组拷贝而非引用赋值，确保去重比较的 `.sort()` 操作不会修改原始场景的 tracks 数组。

#### Scenario: 应用自定义场景后场景定义顺序不变
- **WHEN** 用户应用包含泳道 `["deliverInputEvent", "Focused app", "Transition", "VSYNC-app"]` 的自定义场景
- **THEN** 应用完成后，该自定义场景的 tracks 数组仍为 `["deliverInputEvent", "Focused app", "Transition", "VSYNC-app"]`，顺序不变

#### Scenario: 重复应用同一场景多次后顺序不变
- **WHEN** 用户对同一自定义场景连续应用 5 次
- **THEN** 每次应用后查看该场景的泳道配置，顺序始终与初始定义一致

#### Scenario: 历史记录去重不影响其他历史条目
- **WHEN** 用户应用场景 A 后再应用场景 B
- **THEN** 场景 A 在历史记录中的 tracks 顺序不受场景 B 的 addToHistory 调用影响

### Requirement: Pin 后强制重排 pinned tracks 为用户定义顺序

系统 SHALL 在所有 `pin()` 操作完成后，尝试直接操作 Perfetto workspace 内部树结构，将 pinned tracks 按用户场景定义的顺序重新排列。

#### Scenario: Perfetto 版本支持树操作 API
- **WHEN** pinned track 的 `parent` 属性可用且容器节点的 `removeChild` 和 `addChildLast` 方法可用
- **THEN** 系统执行子节点重排，pinned tracks 按场景定义顺序显示

#### Scenario: Perfetto 版本不支持树操作 API
- **WHEN** pinned track 的 `parent` 属性不可用或容器节点缺少 `removeChild`/`addChildLast` 方法
- **THEN** 系统跳过重排步骤，输出警告日志，降级为仅依赖 `pin()` 调用顺序

#### Scenario: 场景泳道与手动 pin 泳道共存
- **WHEN** 用户手动 pin 了泳道 X，然后应用包含 `["A", "B", "C"]` 的场景
- **THEN** pinned 区域顺序为 `A, B, C, X`（场景泳道在前按定义顺序，手动 pin 泳道在后）
