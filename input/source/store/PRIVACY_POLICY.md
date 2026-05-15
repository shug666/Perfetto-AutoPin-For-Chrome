# Privacy Policy - Perfetto Auto-Pin

**Last Updated:** 2024-12-31

## Overview

Perfetto Auto-Pin is a browser extension that helps users pin tracks in Perfetto UI for Android performance analysis. This privacy policy explains how we handle your data.

## Data Collection

**We do not collect any personal data.**

Perfetto Auto-Pin operates entirely locally within your browser. No data is transmitted to any external servers.

## Data Storage

The extension stores the following data locally in your browser using Chrome's storage API:

- **Custom Scenes:** Track combinations you create
- **Modified Presets:** Your customizations to preset scenes
- **Settings:** Your preferences (fuzzy match, case sensitivity)
- **History:** Recently used scenes (stored locally, max 5 entries)

All data is stored using `chrome.storage.sync`, which may sync across your Chrome browsers if you're signed into Chrome. This is a standard Chrome feature and we do not have access to this data.

## Permissions

The extension requires the following permissions:

- **storage:** To save your preferences and custom scenes locally
- **activeTab:** To interact with the active Perfetto UI tab
- **scripting:** To inject the content script that communicates with Perfetto's API

## Host Permissions

- **https://ui.perfetto.dev/*:** The extension only operates on the Perfetto UI website

## Third-Party Services

This extension does not use any third-party analytics, tracking, or advertising services.

## Data Sharing

We do not share, sell, or transfer any user data to third parties.

## Data Export/Import

Users can export and import their configuration data (custom scenes, settings) as JSON files. This data is handled entirely by the user and is not transmitted anywhere.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this policy.

## Contact

If you have any questions about this privacy policy, please contact:

- Author: Gracker
- Website: https://www.androidperformance.com/

## Open Source

This extension is open source. You can review the source code to verify our privacy practices.

---

# 隐私政策 - Perfetto Auto-Pin

**最后更新：** 2024-12-31

## 概述

Perfetto Auto-Pin 是一款帮助用户在 Perfetto UI 中快速 Pin 泳道的浏览器扩展，用于 Android 性能分析。本隐私政策说明我们如何处理您的数据。

## 数据收集

**我们不收集任何个人数据。**

Perfetto Auto-Pin 完全在您的浏览器本地运行。没有任何数据被传输到外部服务器。

## 数据存储

扩展使用 Chrome 存储 API 在本地存储以下数据：

- **自定义场景：** 您创建的泳道组合
- **修改的预设：** 您对预设场景的自定义修改
- **设置：** 您的偏好设置（模糊匹配、大小写敏感等）
- **历史记录：** 最近使用的场景（本地存储，最多 5 条）

所有数据使用 `chrome.storage.sync` 存储，如果您登录了 Chrome，数据可能会在您的 Chrome 浏览器之间同步。这是 Chrome 的标准功能，我们无法访问这些数据。

## 权限说明

扩展需要以下权限：

- **storage：** 在本地保存您的偏好设置和自定义场景
- **activeTab：** 与当前 Perfetto UI 标签页交互
- **scripting：** 注入内容脚本以与 Perfetto API 通信

## 主机权限

- **https://ui.perfetto.dev/*：** 扩展仅在 Perfetto UI 网站上运行

## 第三方服务

本扩展不使用任何第三方分析、跟踪或广告服务。

## 数据共享

我们不会向第三方分享、出售或转移任何用户数据。

## 数据导出/导入

用户可以将配置数据（自定义场景、设置）导出和导入为 JSON 文件。这些数据完全由用户控制，不会被传输到任何地方。

## 政策变更

我们可能会不时更新本隐私政策。任何更改都将反映在本政策顶部的"最后更新"日期中。

## 联系方式

如果您对本隐私政策有任何疑问，请联系：

- 作者：Gracker
- 网站：https://www.androidperformance.com/

## 开源

本扩展是开源的。您可以查看源代码以验证我们的隐私实践。
