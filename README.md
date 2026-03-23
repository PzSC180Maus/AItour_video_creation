# AItour Video Creation

忆景创影是一个基于微信小程序与微信云开发的 AI 文旅视频生成原型。当前版本重点打通了“信息采集 -> 模式选择 -> 对话生成 -> 脚本生成 -> 视频配置”的前端流程。

## 项目概览

- 产品定位：文旅场景下的 AI 内容生成体验原型
- 技术栈：微信小程序原生开发、微信云开发、JavaScript、mina-request
- 当前状态：主流程可运行，视频生成链路仍有占位逻辑

## 功能列表

1. 首页信息采集
- 支持昵称输入与头像选择
- 用户信息写入全局状态，供后续页面复用

2. 模式选择
- 官方模式：先选景点，再进入对话
- 个性化模式：直接进入脚本生成

3. 景点选择
- 内置示例景点
- 选中后写入任务数据

4. 对话页
- 初始化请求与多轮对话
- 以聊天消息流展示 AI 返回内容

5. 脚本页
- 基于任务数据生成脚本
- 支持重新生成、编辑、复制、跳转配置页

6. 视频配置页
- 包含上传与配置入口
- 生成逻辑当前以演示流程为主

## 页面流程

官方模式：
首页 -> 模式选择 -> 景点选择 -> 对话页 -> 脚本页 -> 视频配置页

个性化模式：
首页 -> 模式选择 -> 脚本页 -> 视频配置页

## 目录结构

```text
.
├─ cloudfunctions/
│  └─ quickstartFunctions/
│     ├─ index.js
│     ├─ config.json
│     └─ package.json
├─ miniprogram/
│  ├─ app.js
│  ├─ app.json
│  ├─ app.wxss
│  ├─ pages/
│  │  ├─ index/
│  │  ├─ mode_select/
│  │  ├─ scenery_select/
│  │  ├─ dialogue/
│  │  ├─ script/
│  │  ├─ v_config/
│  │  ├─ wait/
│  │  └─ v_output/
│  ├─ components/
│  └─ utils/
├─ package.json
├─ project.config.json
└─ project.private.config.json
```

## 快速开始

### 1. 环境准备

- 微信开发者工具
- Node.js 16+
- 有效的小程序 AppID
- 已开通的微信云开发环境

### 2. 安装依赖

```bash
npm install
```

如需安装云函数依赖：

```bash
cd cloudfunctions/quickstartFunctions
npm install
```

### 3. 导入与构建

1. 使用微信开发者工具导入项目根目录
2. 确认项目配置中的 `miniprogramRoot` 和 `cloudfunctionRoot`
3. 执行“工具 -> 构建 npm”
4. 编译并预览

## 关键配置

请不要把真实配置直接提交到仓库。以下示例均使用占位符。

### 1. 云开发环境配置

在小程序全局初始化处设置：

```js
env: "<YOUR_CLOUD_ENV_ID>"
```

### 2. 后端接口配置

当前对话与脚本页面通过 `mina-request` 调用后端，请改为你的服务地址：

```js
baseURL: "https://<YOUR_API_DOMAIN>/<API_PREFIX>"
```

涉及页面：

- miniprogram/pages/dialogue/dialogue.js
- miniprogram/pages/script/script.js

### 3. 微信公众平台域名白名单

如果请求外部服务，请在小程序后台配置合法域名，并优先使用 HTTPS。

## 全局数据说明

页面间通过 `app.globalData.task_data` 共享任务状态，常见字段包括：

- `openid`
- `spot_url`
- `request`
- `scriptContent`
- `user_potrait`

## 隐私与安全

- 不要在仓库提交任何真实 `AppID`、云环境 ID、IP、域名令牌或密钥。
- 不要在代码或文档中保留测试账号、手机号、身份证等个人信息。
- `project.private.config.json` 属于本地私有配置，不应包含可公开传播的敏感数据。
- 推荐通过环境隔离（开发/测试/生产）管理接口地址与鉴权信息。
- 对外发布前，请执行一次敏感信息自检（关键词：`appid`、`secret`、`token`、`key`、`password`、`http://内网IP`）。

## 当前限制

1. 视频生成链路仍有占位逻辑，尚未完全打通。
2. `wait` 与 `v_output` 页面仍以基础展示为主。
3. 接口地址目前由页面内配置，建议后续统一抽离。

## 后续建议

1. 新增统一配置模块，集中管理 API 域名与超时重试策略。
2. 将景点与文案配置迁移为可维护的数据源。
3. 增加错误监控与关键行为埋点。
4. 增加端到端联调文档与回归测试清单。

## License

本项目采用仓库根目录 `LICENSE` 文件中的许可协议。
