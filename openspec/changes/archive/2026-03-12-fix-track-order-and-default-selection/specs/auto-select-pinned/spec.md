## ADDED Requirements

### Requirement: 已 Pin 泳道自动选中

系统 SHALL 在泳道选择 Tab 加载泳道列表时，自动将状态为 `pinned: true` 的泳道加入选中集合（`selectedTracks`），并在 UI 中显示为勾选状态。

#### Scenario: 加载泳道列表时已 Pin 泳道默认勾选
- **WHEN** 用户切换到泳道选择 Tab，加载泳道列表，其中泳道 A 和 C 的状态为 `pinned: true`，泳道 B 为 `pinned: false`
- **THEN** 泳道 A 和 C 的复选框显示为勾选状态，泳道 B 的复选框显示为未勾选状态，选中计数显示 "已选: 2"

#### Scenario: 刷新泳道列表时重新同步选中状态
- **WHEN** 用户在泳道选择 Tab 点击刷新按钮，重新加载泳道列表
- **THEN** 系统 SHALL 根据最新的泳道 `pinned` 状态重新设置选中集合，之前手动勾选/取消的状态被替换为当前实际 Pin 状态

#### Scenario: 无已 Pin 泳道时选中集合为空
- **WHEN** 加载泳道列表时所有泳道均为 `pinned: false`
- **THEN** 所有复选框显示为未勾选状态，选中计数显示 "已选: 0"

### Requirement: 选中状态与 Pin 按钮联动

系统 SHALL 在自动选中已 Pin 泳道后，同步更新 "Pin 选中" 按钮的禁用状态。

#### Scenario: 有已 Pin 泳道时 Pin 按钮可用
- **WHEN** 加载泳道列表后存在已 Pin 泳道（自动选中）
- **THEN** "Pin 选中" 按钮 SHALL 处于可用（非 disabled）状态
