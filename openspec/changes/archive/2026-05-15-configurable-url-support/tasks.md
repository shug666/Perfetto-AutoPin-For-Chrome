## 1. Manifest 配置调整

- [x] 1.1 修改 `manifest.json`：移除静态 `content_scripts` 配置块（bridge.js 和 content.css 改为动态注册）
- [x] 1.2 修改 `manifest.json`：将 `host_permissions` 中的 `https://ui.perfetto.dev/*` 保留，并新增 `optional_host_permissions: ["<all_urls>"]``
- [x] 1.3 修改 `manifest.json`：将 `web_accessible_resources` 的 `matches` 改为 `["<all_urls>"]`，使 content.js 在所有网址上可被加载
- [x] 1.4 修改 `manifest.json`：确保 `permissions` 中包含 `scripting`（用于动态脚本注册）

## 2. URL 管理核心模块（background.js）

- [x] 2.1 新增 `getDefaultUrls()` 函数，返回默认 URL 列表 `["https://ui.perfetto.dev"]`
- [x] 2.2 新增 `getSupportedUrls()` 函数，从 `chrome.storage.sync` 读取 `supportedUrls`，若不存在则返回默认列表
- [x] 2.3 新增 `registerDynamicContentScripts(urls)` 函数，使用 `chrome.scripting.registerContentScripts` 注册 bridge.js 和 content.css 到指定 URL 模式
- [x] 2.4 新增 `unregisterDynamicContentScripts()` 函数，清除已注册的动态内容脚本
- [x] 2.5 新增 `refreshContentScripts()` 函数，调用 unregister 后重新 register，用于 URL 列表变更后刷新
- [x] 2.6 在 `chrome.runtime.onInstalled` 和 `chrome.runtime.onStartup` 事件中调用 `refreshContentScripts()`
- [x] 2.7 新增消息处理：监听来自 popup 的 `ADD_SUPPORTED_URL` 消息，执行权限请求 + 存储更新 + 脚本刷新
- [x] 2.8 新增消息处理：监听来自 popup 的 `REMOVE_SUPPORTED_URL` 消息，执行存储更新 + 脚本刷新 + 权限释放
- [x] 2.9 新增消息处理：监听来自 popup 的 `GET_SUPPORTED_URLS` 消息，返回当前 URL 列表

## 3. Badge 状态适配（background.js）

- [x] 3.1 修改 `chrome.tabs.onUpdated` 监听器中的 URL 检查逻辑，从 `tab.url.includes('ui.perfetto.dev')` 改为调用 `isUrlSupported(url)` 动态匹配
- [x] 3.2 新增 `isUrlSupported(url)` 辅助函数，遍历 `supportedUrls` 列表检查当前 URL 是否匹配
- [x] 3.3 修改 `chrome.commands.onCommand` 中的 URL 检查逻辑，同样使用 `isUrlSupported`

## 4. Popup 连接检测适配（popup.js）

- [x] 4.1 修改 `checkPerfettoTab()` 函数，将 `tab.url.includes("ui.perfetto.dev")` 替换为动态 URL 匹配逻辑
- [x] 4.2 新增 `isUrlSupported(url)` 辅助函数到 popup.js 中，或通过消息从 background.js 获取 URL 列表进行本地匹配
- [x] 4.3 在 `init()` 中先获取 URL 列表，再执行 `checkPerfettoTab()`

## 5. 设置 UI - 网址管理界面（popup.html + popup.css + popup.js）

- [x] 5.1 在 `popup.html` 的设置 Tab 中新增 "支持的网址" section，包含网址列表容器和添加表单（输入框 + 添加按钮）
- [x] 5.2 在 `popup.css` 中添加网址管理相关样式：网址列表项、默认标签、删除按钮、输入框样式
- [x] 5.3 在 `popup.js` 中新增 `renderSupportedUrls()` 函数，渲染网址列表（默认网址显示"默认"标签，自定义网址显示删除按钮）
- [x] 5.4 在 `popup.js` 中新增 `addSupportedUrl()` 函数，处理 URL 输入验证、去重、发送 `ADD_SUPPORTED_URL` 消息到 background
- [x] 5.5 在 `popup.js` 中新增 `removeSupportedUrl(url)` 函数，发送 `REMOVE_SUPPORTED_URL` 消息到 background
- [x] 5.6 在 `popup.js` 中新增 URL 校验逻辑：检查协议前缀、提取 origin、去重
- [x] 5.7 在 `setupEventListeners()` 中绑定添加按钮点击事件和输入框回车事件
- [x] 5.8 在 `loadSettings()` 中加载 URL 列表并初始渲染
- [x] 5.9 更新 `popup.html` 中 `not-perfetto` 警告区域的文案，引导用户通过设置添加网址

## 6. 数据导入/导出兼容

- [x] 6.1 修改 `exportConfig()` 函数，将 `supportedUrls` 加入导出数据
- [x] 6.2 修改 `importConfig()` 函数，支持导入 `supportedUrls` 字段（若存在），并触发内容脚本刷新
- [x] 6.3 确保向后兼容：导入不包含 `supportedUrls` 的旧配置时，保留当前 URL 列表不变

## 7. 测试与验证

- [x] 7.1 验证默认安装后 `https://ui.perfetto.dev` 上功能正常（Badge、内容脚本注入、Popup 连接）
- [x] 7.2 验证添加自定义 URL 后，该页面上插件功能正常工作
- [x] 7.3 验证删除自定义 URL 后，该页面上插件不再工作
- [x] 7.4 验证默认 URL 不可删除
- [x] 7.5 验证无效 URL 输入被正确拒绝
- [x] 7.6 验证配置导入/导出包含 URL 列表且功能正确

## 8. 遗留问题修复 (Hybrid 注入模式)

- [x] 8.1 恢复 `manifest.json` 中关于默认 URL 的静态 `content_scripts` 声明
- [x] 8.2 修改 `background.js` 的 `registerDynamicContentScripts` 排除默认 URL
- [x] 8.3 修改 `background.js` 新增 `INJECT_SCRIPTS_TO_TAB` 消息处理器，用于主动执行注入
- [x] 8.4 修改 `popup.js` 的 `checkPerfettoTab`，在 PING 失败时主动请求注入并重试
- [x] 8.5 修改 `bridge.js` 增加 `__perfettoAutoPinBridgeLoaded` 防重复注入保护
- [x] 8.6 清理 `popup.js` 中 `importConfig` 函数里为刷新动态脚本写的冗余代码
