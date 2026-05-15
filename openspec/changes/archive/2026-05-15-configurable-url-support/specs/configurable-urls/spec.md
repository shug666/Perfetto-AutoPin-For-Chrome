## ADDED Requirements

### Requirement: Default URL list
系统 SHALL 在初始安装时包含 `https://ui.perfetto.dev` 作为默认支持的网址，且该默认网址 MUST NOT 被用户删除。

#### Scenario: First install
- **WHEN** 用户首次安装插件
- **THEN** 支持的网址列表中包含且仅包含 `https://ui.perfetto.dev`

#### Scenario: Attempt to delete default URL
- **WHEN** 用户尝试删除默认网址 `https://ui.perfetto.dev`
- **THEN** 系统拒绝删除并显示提示信息

### Requirement: Add custom URL
用户 SHALL 能够通过设置界面的输入框添加新的 Perfetto UI 网址。输入的 URL MUST 以 `http://` 或 `https://` 开头。

#### Scenario: Add valid URL
- **WHEN** 用户在输入框中输入 `https://perfetto.internal.company.com` 并点击添加按钮
- **THEN** 该网址被添加到支持列表中，并立即显示在列表中

#### Scenario: Add invalid URL
- **WHEN** 用户输入不以 `http://` 或 `https://` 开头的内容（如 `perfetto.local`）并点击添加
- **THEN** 系统显示错误提示 "网址必须以 http:// 或 https:// 开头"，且网址不会被添加

#### Scenario: Add duplicate URL
- **WHEN** 用户输入一个已存在于列表中的网址并点击添加
- **THEN** 系统显示提示 "该网址已存在"，且不会重复添加

#### Scenario: URL normalization
- **WHEN** 用户输入 `https://perfetto.example.com/some/path`
- **THEN** 系统自动截取 origin 部分 `https://perfetto.example.com` 并添加到列表

### Requirement: Delete custom URL
用户 SHALL 能够从支持列表中删除自己添加的自定义网址。

#### Scenario: Delete custom URL
- **WHEN** 用户点击某个自定义网址旁的删除按钮
- **THEN** 该网址从列表中移除，插件不再在该网址上运行

### Requirement: URL list persistence
支持的网址列表 SHALL 通过 `chrome.storage.sync` 持久化存储，并在多设备间同步。

#### Scenario: Persist across sessions
- **WHEN** 用户添加了自定义网址后关闭并重新打开浏览器
- **THEN** 之前添加的网址仍然存在于列表中

### Requirement: Dynamic content script registration
插件 SHALL 根据支持的网址列表动态注册内容脚本，使 bridge.js 和 content.css 在所有匹配的网址上自动注入。

#### Scenario: Content script injection on custom URL
- **WHEN** 用户添加了 `https://perfetto.internal.com` 后打开该网址
- **THEN** bridge.js 和 content.css 被自动注入到该页面，插件功能正常工作

#### Scenario: Content script removal after URL deletion
- **WHEN** 用户删除了某个自定义网址后刷新对应页面
- **THEN** 插件不再在该页面注入内容脚本

### Requirement: Dynamic host permission management
插件 SHALL 在用户添加新网址时通过 `chrome.permissions.request` API 请求对应的 host 权限。

#### Scenario: Permission request on add
- **WHEN** 用户添加新的自定义网址
- **THEN** 浏览器弹出权限请求对话框，用户确认后才完成添加

#### Scenario: Permission denied
- **WHEN** 用户在权限请求对话框中点击拒绝
- **THEN** 网址不会被添加到列表中，系统显示提示信息

### Requirement: Badge status for custom URLs
Background Service Worker SHALL 在所有支持的网址上正确显示 "ON" Badge 状态。

#### Scenario: Badge on custom URL
- **WHEN** 用户导航到一个已添加的自定义 Perfetto UI 网址
- **THEN** 扩展图标显示绿色 "ON" Badge

#### Scenario: Badge on unsupported URL
- **WHEN** 用户导航到一个不在支持列表中的网址
- **THEN** 扩展图标不显示 Badge

### Requirement: Popup connection detection for custom URLs
Popup 页面 SHALL 在所有支持的网址上正确检测连接状态并显示主界面。

#### Scenario: Connection on custom URL
- **WHEN** 用户在已添加的自定义 Perfetto UI 网址上打开 Popup
- **THEN** Popup 显示 "已连接" 状态并展示主功能界面

### Requirement: Settings UI for URL management
设置 Tab 中 SHALL 包含一个 "支持的网址" 管理区域，包含网址列表和添加表单。

#### Scenario: View URL list in settings
- **WHEN** 用户切换到设置 Tab
- **THEN** 可以看到当前所有支持的网址列表，默认网址有特殊标记（如"默认"标签），自定义网址旁有删除按钮

#### Scenario: Add URL from settings
- **WHEN** 用户在输入框中输入网址并点击添加按钮（或按 Enter 键）
- **THEN** 触发添加流程（权限请求 → 添加到列表 → 注册脚本）
