# web-extension（Chrome 扩展 / MV3）

本文档用于梳理 `packages/web-extension` 的**实现逻辑**与**使用方法**（中文）。

---

## 1. 目录与入口

### 1.1 构建入口（Vite 多入口）

Vite 配置：`packages/web-extension/vite.config.js`

- **页面入口（HTML）**
  - `src/index.html`：Popup（`action.default_popup`）+ Options（`index.html#/options`）
  - `src/editor.html`：编辑器页（独立入口）
  - `src/view.html`：预览/查看页
  - `src/templates.html`：模板页
- **脚本入口（JS）**
  - `src/background.js`：MV3 Service Worker
  - `src/content.js`：内容脚本（主要注入 UI / 与页面交互）
  - `src/page.js`：通用采集脚本（Readability/reader）
  - `src/api.js`：页面桥接（跨 frame、postMessage / chrome messaging）
  - `src/segmenftfault.js`：Segmentfault / 头条等站点的发布辅助脚本
  - `src/autoformat.js`：格式化工具脚本

### 1.2 运行入口（manifest）

Manifest：`packages/web-extension/src/manifest.json`

- **MV3 Service Worker**：`background.service_worker = "background.js"`
- **Popup**：`action.default_popup = "index.html"`
- **Options**：`options_ui.page = "index.html#/options"`
- **Content Scripts**：见 manifest 的 `content_scripts`（`content.js/page.js/api.js/segmenftfault.js` + `public/libs/*`）

### 1.3 静态资源（public）

`packages/web-extension/public/`：会被原样拷贝到 `dist/`（CSS、图片、第三方 libs）。

---

## 2. 构建与安装

### 2.1 构建

在 `packages/web-extension` 目录执行：

```bash
pnpm build
```

输出目录：`packages/web-extension/dist`

### 2.2 安装到 Chrome（开发者模式）

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择：`packages/web-extension/dist`

> 建议：每次改代码/重新 build 后，如遇到诡异缓存问题，优先 **Remove 扩展后重新加载**。

---

## 3. 运行时架构（核心链路）

### 3.1 Service Worker：`src/background.js`

职责：

- 任务队列调度与执行（同步发布）
- 与 Popup / Content Script 的消息通信（`chrome.runtime.onMessage`）
- 右键菜单（`chrome.contextMenus`）
- 任务状态通知（`chrome.notifications`）

### 3.2 Drivers：`@wechatsync/drivers`

职责：对接各平台发布（知乎/简书/头条/Segmentfault/WordPress…）

关键机制：

- `packages/@wechatsync/drivers/index.js` 通过 `import.meta.glob('./src/*.js', { eager: true })` 自动收集 adapter
- 通过 `module.default.name` 生成映射（所以 web-extension 的 Vite 配置里启用了 `esbuild.keepNames=true`，防止生产压缩改写类名导致映射失效）

### 3.3 Content Scripts（采集/交互）

常见分工：

- `src/content.js`：负责在特定站点注入 UI、监听来自 background 的消息、触发采集/同步
- `src/page.js`：负责通用页面文章抽取（Readability/reader）
- `src/api.js`：负责跨 frame 的桥接与消息转发

---

## 4. 消息协议（background <-> content/popup）

### 4.1 background 接收的 `request.action` 列表

在 `src/background.js` 的 `chrome.runtime.onMessage` 中处理：

- **`getDriverMeta`**
  - **入参**：无
  - **出参**：`window.driverMeta`
- **`reloadDriver`**
  - **入参**：无
  - **出参**：`{ status: 1 }`
- **`getAccount`**
  - **入参**：无（内部会合并内置平台账号 + 动态获取的 publicAccounts）
  - **出参**：`accounts.concat(publicAccounts)`
- **`addTask`**
  - **入参**：`{ task }`
  - **行为**：给 task 补 `status='wait'`、`guid`，写入 storage
  - **出参**：`guid`
- **`parseArticle`**
  - **入参**：`{ account, data }`
  - **行为**：`driver.getArticle(request.data)`
  - **出参**：`{ article }`
- **`getCache`**
  - **入参**：`{ name }` 或 `{ names: [] }`
  - **出参**：`{ result }`
- **`setCache`**
  - **入参**：`{ name, value }`
  - **出参**：无（异步）
- **`sendEvent`**
  - **入参**：`{ event: { category, action, label } }`
  - **出参**：无（异步）
- **`startInspect`**
  - **入参**：无（基于 sender.tab 记录 watcher）
  - **出参**：无
- **`updateDriver`**
  - **入参**：`{ data: { code, dev, patch, name } }`
  - **行为**：基于 `getDriverProvider(code)` 动态更新/patch driver（生产环境会写入 storage）
  - **出参**：`{ result: { status, error? } }`
- **`callDriverMethod`**
  - **入参**：`{ data: { account, ... }, methodName }`
  - **行为**：调用 driver 对应方法；`uploadImage` 走 `upImage(...)`
  - **出参**：`{ result }` 或 `{ error }`

### 4.2 content/popup 接收的 `request.method`（示例）

在多处组件中出现：

- **`taskUpdate`**：任务状态更新（background/store 在 `editTask` 时推送）
- **`consoleLog`**：调试日志透传
- **`fetchArticle`**：由右键菜单触发，content/page 侧执行采集

---

## 5. 数据结构（storage）

存储实现：`src/db/store.js`（基于 `chrome.storage.local`）

### 5.1 accounts

键：`accounts`

单项结构（常见字段）：

- `uid`: string
- `type`: string（平台类型：`zhihu/juejin/segmentfault/wordpress/...`）
- `title`: string
- `params`: object（平台登录信息/配置）

### 5.2 tasks

键：`tasks`

task 结构（核心字段）：

- `guid`: string（background 接收 addTask 时生成）
- `status`: `'wait' | 'uploading' | 'done' | 'failed'`
- `post`: object（文章内容：title/link/content/markdown 等，具体以采集结果为准）
- `accounts`: array（要同步的平台账号列表；执行时会给每个 account 写入 status/editResp/error 等）
- `startTime/endTime/msg/totalImages/uploadedCount...`（执行过程字段）

任务上限：`maxTaskLength = 25`（超过会 shift 最老的）

### 5.3 任务推送

`Store.editTask(tid, obj)` 更新任务后，会尝试：

- 找到 `window.syncer.getSender(task.guid)` 对应的 tab
- `chrome.tabs.sendMessage(tabId, { method: 'taskUpdate', task })`

---

## 6. 同步执行流程（简化）

1. 用户在 Popup/页面触发采集 → content/page 侧得到文章结构
2. content/popup 发送 `action=addTask` 给 background
3. background 写入 tasks，并记录 sender（用于后续 taskUpdate 推送）
4. background 的执行器循环（轮询 tasks）：
   - 找出 `status='wait'` 的任务
   - 标记为 uploading
   - 对每个 account：
     - `driver = getDriver(account)`
     - `driver.addPost(...)`
     - 上传图片 `uploadFile` / `upImage`
     - `driver.editPost(...)`
   - 成功后标记 done，失败写入 error/msg
   - 过程中持续 `editTask` 推送进度到前端

---

## 7. MV3 关键注意事项（2025）

- **禁止 `chrome.contextMenus.create({ onclick })`**：必须使用 `chrome.contextMenus.onClicked`
- **禁止动态 `import()` 作为 SW 入口组织方式**：SW 直接用 `background.js` 入口即可
- **无 `webRequestBlocking`**：修改请求头需走 `declarativeNetRequest`（本项目已做兼容注入）
- **无 DOM 环境**：Service Worker 里没有 `window/document/DOMParser`
  - 本项目通过 Vite/Rollup `banner` 注入了 minimal `window/DOMParser`（用于避免部分库走 Node fallback 的 `require('jsdom')` 分支）
  - 注意：这只是“防崩溃”的最小兼容，不代表可以在 SW 里做复杂 DOM 解析

---

## 8. 调试建议

- **查看 Service Worker 日志**：`chrome://extensions` → 该扩展 → Service worker → Inspect
- **缓存问题**：出现“明明 build 了但还报旧错误”，优先：
  - Remove 扩展
  - 重新加载 `dist`

---

## 9. 如何使用（面向用户）

下面按“从 0 到可用”的顺序说明一次完整使用流程。

### 9.1 打开入口

- **Popup（扩展弹窗）**：点击浏览器工具栏中的扩展图标，会打开 `index.html`
- **设置页（Options）**：扩展详情页进入“扩展程序选项”，或直接打开 `index.html#/options`

### 9.2 添加/管理同步账号

1. 打开 Popup 或 Options 页面
2. 进入“账号/平台管理”（不同页面文案可能略有差异）
3. 选择要同步的平台（如：知乎、掘金、Segmentfault、WordPress 等）
4. 按页面提示完成登录/粘贴 Cookie/填写站点信息（不同平台参数不同）
5. 保存后，账号会写入 `chrome.storage.local` 的 `accounts`

> WordPress / Typecho 类平台通常需要填写站点地址、用户名、密码等；其它平台可能依赖浏览器当前登录态或 Cookie。

### 9.3 采集文章（从网页提取内容）

两种常见触发方式（取决于页面注入逻辑与站点匹配规则）：

- **方式 A：右键菜单**

  1. 在文章页面空白处/链接上右键
  2. 选择菜单：**“提取文章并同步”**
  3. 扩展会向当前 tab 发送 `method=fetchArticle`，由内容脚本/采集脚本执行提取

- **方式 B：页面内注入入口（若该站点支持）**
  - 部分站点（例如微信公众号后台）会在页面注入操作入口，点击后触发采集。

### 9.4 发起同步（创建任务）

当采集到文章后，前端会组装一个 task 并发给 background：

- `chrome.runtime.sendMessage({ action: 'addTask', task })`

然后：

- background 会补 `task.guid`、`task.status='wait'` 并保存到 `tasks`
- 任务开始执行时会变为 `uploading`，成功后为 `done`，失败为 `failed`

### 9.5 查看进度与结果

同步过程中：

- background 会不断更新任务并向触发任务的 tab 推送：
  - `chrome.tabs.sendMessage(tabId, { method: 'taskUpdate', task })`

你可以在以下位置看到进度/结果（具体 UI 位置以页面为准）：

- Popup 的任务列表 / 任务详情页
- 编辑器页/预览页里与任务相关的状态提示

### 9.6 常见问题（使用侧）

- **没有看到右键菜单**

  - 确认扩展已启用并有 `contextMenus` 权限
  - 尝试刷新页面后再右键
  - 某些页面（如 Chrome 内置页面）无法注入脚本

- **一直“上传中/同步中”**

  - 打开 Service Worker Inspect 查看第一条报错
  - 某些平台可能需要你先在该平台网页完成登录

- **同步失败（平台返回未登录/403/风控）**
  - 重新登录平台账号或更新 Cookie
  - 降低频率/间隔重试（部分平台对频繁请求敏感）
