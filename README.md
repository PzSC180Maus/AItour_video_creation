# AItour Video Creation

忆景创影是一个基于微信小程序与微信云开发的 AI 文旅短剧生成原型。项目围绕“我们不拍风景，我们拍你心中的风景”这一思路，尝试把用户头像、旅行偏好、景点素材和对话式生成流程串联起来，输出可用于视频生成的脚本与后续素材配置。

## 项目定位

- 产品方向：文旅情感记忆型 AI 短剧生成器
- 核心体验：从“选择景点/表达需求”到“对话补全创意”再到“生成脚本与视频配置”
- 当前状态：小程序端主流程已搭建，视频生成链路仍以演示和占位逻辑为主

## 当前功能

项目目前已经包含以下功能模块：

1. 首页用户信息采集
   - 支持昵称输入与头像选择
   - 用户信息写入全局状态，供后续页面复用
2. 模式选择
   - 官方模式：先选景点，再进入对话生成
   - 个性化模式：直接进入脚本生成流程
3. 景点选择
   - 内置多个旅行目的地示例
   - 选中后将景点图片和提示词写入任务数据
4. 对话生成
   - 将任务数据发送到外部后端接口
   - 以聊天形式展示 AI 返回内容
5. 脚本生成
   - 根据当前对话上下文请求脚本内容
   - 支持重新生成、复制脚本、进入视频配置页
6. 视频配置演示页
   - 支持上传个人肖像
   - 视频生成逻辑当前为前端演示版提示
7. 微信云函数
   - 获取当前用户 OpenID
   - 保留微信云开发模板内的数据集合示例能力

## 页面流程

### 官方模式

首页 -> 模式选择 -> 景点选择 -> 对话页 -> 脚本页 -> 视频配置页

### 个性化模式

首页 -> 模式选择 -> 脚本页 -> 视频配置页

## 技术栈

- 微信小程序原生开发
- 微信云开发 / 云函数
- mina-request 用于请求外部接口
- JavaScript

## 项目结构

```text
.
├─ cloudfunctions/
│  └─ quickstartFunctions/     # 云函数：获取 openid、示例数据库操作等
├─ miniprogram/
│  ├─ pages/
│  │  ├─ index/                # 首页
│  │  ├─ mode_select/          # 模式选择
│  │  ├─ scenery_select/       # 景点选择
│  │  ├─ dialogue/             # 对话页
│  │  ├─ script/               # 脚本生成页
│  │  ├─ v_config/             # 视频配置页
│  │  ├─ wait/                 # 等待页（当前为占位）
│  │  └─ v_output/             # 视频结果页（当前为占位）
│  ├─ components/
│  ├─ utils/
│  └─ app.js                   # 全局状态、云开发初始化、openid 获取
├─ package.json                # 小程序端依赖
├─ project.config.json         # 微信开发者工具项目配置
└─ uploadCloudFunction.sh      # 云函数部署命令示例
```

## 关键全局数据

项目通过 app.globalData.task_data 在页面之间共享任务状态，当前包含：

- openid：通过云函数获取的用户唯一标识
- spot_url：当前选择景点的图片地址
- request：当前发送给后端的请求内容
- scriptContent：生成得到的视频脚本
- user_potrait：用户肖像，当前字段已预留

## 开发前准备

### 1. 安装环境

- 微信开发者工具
- Node.js 16 或更高版本
- 可用的微信小程序 AppID
- 已开通的微信云开发环境

### 2. 安装依赖

在项目根目录执行：

```bash
npm install
```

云函数目录如需单独安装依赖，可执行：

```bash
cd cloudfunctions/quickstartFunctions
npm install
```

### 3. 导入项目

使用微信开发者工具导入项目根目录，并确认以下配置：

- miniprogramRoot 指向 miniprogram/
- cloudfunctionRoot 指向 cloudfunctions/
- appid 已替换为你自己的小程序 AppID

## 必改配置

### 1. 云开发环境 ID

在 miniprogram/app.js 中，当前写死了云环境 ID：

```js
env: ""
```

如果你使用自己的云开发环境，需要替换成实际环境 ID。

### 2. 外部后端接口地址

对话页和脚本页都通过 mina-request 访问后端，目前 baseURL 为局域网地址：

```js
baseURL: ""
```

对应页面：

- miniprogram/pages/dialogue/dialogue.js
- miniprogram/pages/script/script.js

如果后端地址变化，或需要联调测试环境/正式环境，请同步修改这两个文件。

### 3. 小程序合法域名

若后端不是云函数而是外部 HTTP 服务，需要在微信公众平台配置：

- request 合法域名
- 如使用 HTTPS，请确保证书有效

否则真机环境下请求会被拦截。

## 运行方式

### 小程序端

1. 使用微信开发者工具打开项目
2. 执行“工具 -> 构建 npm”
3. 确认 miniprogram_npm 已正确生成
4. 编译并预览小程序

### 云函数部署

可在微信开发者工具中上传并部署 quickstartFunctions，或参考项目根目录脚本：

```bash
${installPath} cloud functions deploy --e ${envId} --n quickstartFunctions --r --project ${projectPath}
```

部署成功后，小程序启动时会调用该云函数获取当前用户 openid。

## 接口说明

当前前端主要依赖以下后端接口：

### 1. 对话接口

- 页面：pages/dialogue/dialogue
- 请求路径：/api/video/hhh
- 请求方式：GET
- 主要参数：task_data

### 2. 脚本生成接口

- 页面：pages/script/script
- 请求路径：/api/video/script
- 请求方式：GET
- 主要参数：task_data

建议后端至少兼容以下字段：

- openid
- spot_url
- request
- scriptContent

## 当前已知限制

1. v_config 页中的视频生成逻辑仍为前端模拟提示，尚未真正调用视频生成服务。
2. wait 与 v_output 页面目前仍是占位页面，尚未接入完整业务。
3. 对话与脚本接口使用的是硬编码局域网地址，不适合直接用于生产环境。
4. 云函数 quickstartFunctions 中仍保留微信云开发模板自带的数据库示例代码，和当前业务只有部分关联。

## 适合下一步完善的方向

1. 抽离统一的接口配置文件，避免多个页面硬编码 baseURL
2. 打通用户肖像上传、任务排队、视频生成、结果轮询与结果展示
3. 为 task_data 建立更清晰的数据结构与字段校验
4. 将景点数据从页面内常量迁移到配置或云端存储
5. 为不同环境增加开发、测试、生产的配置区分

## 许可证