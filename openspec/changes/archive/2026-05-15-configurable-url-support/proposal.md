## Why

当前插件通过 manifest.json 中的 `host_permissions`、`content_scripts.matches` 和 `web_accessible_resources.matches` 将运行范围硬编码为 `https://ui.perfetto.dev/*`。然而，越来越多的团队在内部网络部署了自建的 Perfetto UI 实例（如 `https://perfetto.internal.company.com`），这些用户无法使用本插件。需要提供一个可配置的网址管理功能，让用户在设置界面中手动添加/删除支持的网址，使插件能够在任意 Perfetto UI 实例上工作。

## What Changes

- **新增网址管理 UI**：在"设置"Tab 中增加"支持的网址"管理区域，用户可以添加、删除自定义网址
- **动态内容脚本注入**：使用 `chrome.scripting.registerContentScripts` API 动态注册内容脚本到用户添加的网址，替代静态 manifest 声明
- **扩展 host_permissions**：manifest.json 中的 `host_permissions` 改为 `<all_urls>` 或使用 `optional_host_permissions`，配合 `chrome.permissions` API 按需申请权限
- **网址持久化**：将用户配置的网址列表存储到 `chrome.storage.sync`
- **Badge 状态适配**：background.js 中的 Badge 显示逻辑从硬编码 URL 检查改为动态匹配用户配置的网址列表
- **Popup 连接检测适配**：popup.js 中的 `checkPerfettoTab` 函数从硬编码 URL 检查改为动态匹配

## Capabilities

### New Capabilities
- `configurable-urls`: 用户可通过设置界面管理插件支持的网址列表，实现动态内容脚本注入和权限管理，使插件能在任意 Perfetto UI 部署上运行

### Modified Capabilities
_(无已有 spec 需要修改)_

## Impact

- **manifest.json**: `host_permissions`、`content_scripts`、`web_accessible_resources` 配置需要调整，可能需要新增 `optional_host_permissions` 和 `permissions` 中的 `scripting`
- **background.js**: Badge 状态逻辑需要从硬编码 URL 改为动态匹配；需要新增动态脚本注册逻辑
- **popup.js**: `checkPerfettoTab()` 中的 URL 检查需要改为动态匹配；设置 Tab 需要新增网址管理 UI 逻辑
- **popup.html**: 设置 Tab 需要新增网址管理的 HTML 结构
- **popup.css**: 需要为网址管理 UI 添加样式
- **chrome.storage.sync**: 新增 `supportedUrls` 存储键
- **用户权限**: 可能需要用户授权新增的 host 权限（通过 `chrome.permissions.request`）
