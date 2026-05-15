## Context

Perfetto Auto-Pin 是一款 Manifest V3 Chrome 扩展，通过 Bridge + Content Script 架构与 Perfetto UI 页面交互，实现泳道的自动 Pin 功能。当前所有 URL 匹配规则硬编码为 `https://ui.perfetto.dev/*`，分散在三处：

1. `manifest.json` → `host_permissions`、`content_scripts.matches`、`web_accessible_resources.matches`
2. `background.js` → `tab.url.includes('ui.perfetto.dev')` Badge 状态检查
3. `popup.js` → `tab.url.includes('ui.perfetto.dev')` 连接检测

许多团队在内部部署了独立的 Perfetto UI 实例，当前架构无法支持这些场景。

## Goals / Non-Goals

**Goals:**
- 用户可在设置界面中添加/删除自定义 Perfetto UI 网址
- 插件能在用户配置的所有网址上自动运行（注入内容脚本、显示 Badge）
- 默认保留 `https://ui.perfetto.dev` 作为内置网址，不可删除
- 配置跨设备同步（通过 chrome.storage.sync）
- 保持向后兼容，现有用户升级后无需额外操作

**Non-Goals:**
- 不实现网址的自动发现（不扫描或猜测 Perfetto UI 实例）
- 不实现网址的有效性校验（不主动探测网址是否为 Perfetto UI）
- 不支持通配符 URL 模式（每个网址必须是具体的 origin）
- 不涉及 Firefox 兼容性（当前仅面向 Chrome/Chromium）

## Decisions

### 决策 1: 混合使用静态声明与动态注册（Hybrid 注入模式）

**选择**: 默认 URL 使用 `manifest.json` 静态声明，自定义 URL 使用动态内容脚本注册 API，并在需要时由 Popup 主动触发注入。

**理由**: `chrome.scripting.registerContentScripts` 虽然支持动态配置，但它只对**未来加载的页面**生效，无法自动注入到用户已经打开的标签页中，导致用户在自建 Perfetto 实例上打开 Popup 时会遇到“应用场景失败”的问题。保留默认 URL（`ui.perfetto.dev`）的静态声明，可以保证对绝大多数用户的核心体验绝对可靠。

**实现方式**:
- 保留 `manifest.json` 中关于 `https://ui.perfetto.dev/*` 的静态 `content_scripts` 配置。
- 在 `background.js` 中，注册动态脚本时**排除默认 URL**，仅对用户自定义添加的 URL 调用 `registerContentScripts`。
- **主动注入补救机制**：当 Popup 在支持的自定义 URL 上检测到 PING 失败（即内容脚本尚未运行）时，主动发送 `INJECT_SCRIPTS_TO_TAB` 消息给 Background，要求立刻通过 `chrome.scripting.executeScript` 注入脚本。
- **防重复注入**：在 `bridge.js` 头部增加 `window.__perfettoAutoPinBridgeLoaded` 检查，防止主动注入与未来刷新的自动注入发生冲突。

### 决策 2: 使用 `optional_host_permissions` + `chrome.permissions` API 按需申请权限

**选择**: manifest.json 中声明 `optional_host_permissions: ["<all_urls>"]`，用户添加新网址时通过 `chrome.permissions.request` 请求对应的 host 权限

**理由**: 
- 避免一次性申请 `<all_urls>` 权限（用户会对过宽权限产生不信任）
- Chrome 扩展审核对权限范围有严格要求
- 按需申请符合"最小权限"原则

**替代方案**:
- 直接声明 `host_permissions: ["<all_urls>"]`：权限过宽，影响用户信任和商店审核
- 让用户手动修改 manifest：技术门槛高，不可行

### 决策 3: URL 列表存储在 `chrome.storage.sync`

**选择**: 使用 `supportedUrls` 键存储用户配置的 URL 列表

**理由**: 与现有设置保持一致，支持跨设备同步

**数据结构**:
```javascript
{
  supportedUrls: [
    "https://ui.perfetto.dev"  // 默认内置，不可删除
    // 用户添加的 URL...
  ]
}
```

### 决策 4: URL 格式处理

**选择**: 用户输入的 URL 仅需提供 origin（协议 + 域名 + 端口），插件自动补全 `/*` 通配符后缀用于匹配模式

**理由**: 简化用户输入，避免用户因 URL 格式错误导致功能失效

**校验规则**:
- 必须以 `http://` 或 `https://` 开头
- 自动去除尾部 `/` 和路径部分
- 去重检查

## Risks / Trade-offs

- **[权限弹窗干扰]** → 添加新网址时浏览器会弹出权限请求对话框，可能影响用户体验。缓解：在 UI 中提供说明文字解释为什么需要权限
- **[动态脚本注册时序]** → Service Worker 可能被浏览器休眠后重启，需确保每次启动都重新注册脚本。缓解：在 `onStartup` 事件中执行注册
- **[storage.sync 容量限制]** → `chrome.storage.sync` 单键 8KB 限制。缓解：URL 列表通常很小，不会触及限制
- **[web_accessible_resources 动态化]** → `web_accessible_resources` 无法动态注册，需在 manifest 中使用 `<all_urls>` 匹配。缓解：此字段仅控制 content.js 的可访问性，安全风险可控
