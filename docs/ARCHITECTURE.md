# popo-doc-cli 系统架构与使用说明

本文档面向**项目重构、交接与优化**，描述当前系统架构、数据流、使用方式及可改进点。

---

## 1. 项目概览

| 项目 | 说明 |
|------|------|
| 名称 | popo-doc-cli |
| 类型 | Node.js CLI（ESM） |
| 运行时 | Node.js >= 18.17 |
| 包管理 | npm，单入口打包（tsup） |
| 入口 | `src/index.ts` → 构建为 `dist/index.js`，bin 命令 `popo-doc` |

**核心能力**：基于 POPO 开放平台 Open API，实现「个人文档 / 团队空间」的下载、搜索、获取文档 URL。

---

## 2. 目录与模块结构

```
popo-doc-cli/
├── src/
│   ├── index.ts              # CLI 入口：Commander 子命令与调用流程
│   ├── constants/
│   │   └── index.ts          # 常量：API 基址、轮询参数、文件名等
│   ├── api/
│   │   ├── index.ts          # 聚合导出 auth、document
│   │   ├── auth.ts           # 鉴权：本地配置 / 环境变量 Token 获取与缓存
│   │   ├── shared.ts         # 请求头：注入 Open-Access-Token
│   │   └── document/
│   │       ├── index.ts      # 聚合导出 personal、team
│   │       ├── personal.ts   # 个人文档：详情、URL、搜索、下载、导出
│   │       └── team.ts       # 团队空间：页面详情、导出、下载
│   └── utils/
│       ├── index.ts          # 聚合导出各工具
│       ├── log.ts            # DEBUG 日志与命令错误统一输出
│       ├── request.ts        # 封装 fetch + errcode 校验、统一错误上下文
│       ├── parse-url.ts      # 解析个人 / 团队文档 URL
│       ├── download-file.ts  # 根据 URL 下载并落盘，支持扩展名推断
│       ├── task.ts           # 导出任务轮询，获取最终下载链接
│       ├── local-config.ts   # 本地配置文件读写与缓存
│       └── search.ts         # docType/shareType 枚举文案
├── dist/                     # 构建产物（仅此目录参与 npm 发布）
├── docs/                     # 文档（含本架构说明、发布指南等）
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**分层关系**：

- **CLI 层**：`src/index.ts` 解析参数，调用「工具层 + API 层」完成业务。
- **API 层**：`api/auth`、`api/document`（personal/team），依赖 `constants` 与 `utils`。
- **工具层**：`utils` 提供请求、解析、下载、轮询、配置、日志等通用能力。

---

## 3. 系统架构与数据流

### 3.1 认证（Token）链路

- **用途**：所有 Open API 请求需在 Header 中携带 `Open-Access-Token`。
- **实现位置**：`api/auth.ts`、`api/shared.ts`。

**当前逻辑（与 README 不一致，交接时需确认）**：

1. **优先**：读本地配置 `~/popo-doc-config.json`（或 `%USERPROFILE%` 等），要求包含 `openAccessToken`、`accessExpiredAt`；若存在且未临近过期（当前实现为 `expiresAt > now + 1s`），则直接使用缓存 Token。
2. **回退**：若本地配置不可用，则用环境变量 `POPO_APP_ID`、`POPO_APP_SECRET` 请求 `https://open.popo.netease.com/open-apis/token`，拿到 `openAccessToken` 与 `accessExpiredAt` 后写入本地配置并缓存。

**说明**：README 中描述的「LANGBASE_TOKEN + langbase 认证接口」在当前代码中**未实现**，若线上或内网实际使用 LANGBASE 体系，需要在重构/交接时统一认证方案（见 6.2）。

### 3.2 命令与数据流概览

```
用户输入 (popo-doc <command> ...)
    → Commander 解析
    → 对应 cmd* 函数 (cmdDownload / cmdSearch / cmdUrl)
    → 使用 utils（parseUrl / downloadFile / pollTaskResult 等）
    → 使用 api/document（个人/团队接口）
    → api 通过 api/shared.getHeaders() 注入 Token
    → api/auth 提供 Token（本地配置或 POPO token 接口）
    → 输出：控制台 JSON / 人类可读文案 + JSON
```

### 3.3 三条主流程简述

| 命令 | 入口函数 | 主要步骤 |
|------|----------|----------|
| **download** | `cmdDownload` | 解析 URL → 区分个人/团队 → 取详情 → 按 docType/pageType 选「直接下载」或「导出任务」→ 若有任务则轮询 → 下载到本地 → 输出结果 |
| **search** | `cmdSearch` | 调用个人文档搜索 API → 整理分页与 docType/shareType 文案 → 输出 JSON |
| **url** | `cmdUrl` | 根据 docId 调个人文档 URL 接口 → 输出 URL 与 JSON |

---

## 4. 核心模块说明

### 4.1 入口与 CLI（`src/index.ts`）

- 使用 **Commander** 定义 `popo-doc`、版本号、三个子命令及别名。
- 子命令：
  - `download` / `download-document`：`-u --url` 必填，`-o --output-dir`、`--json` 可选。
  - `search` / `search-documents`：`-q --query` 必填，`-p --page`、`-s --size`、`--search-id`、`--json` 可选。
  - `url` / `get-document-url`：`-d --doc-id` 必填，`--json` 可选。
- 所有命令的异常由 `printCommandError` 统一输出（含 `success: false` 的 JSON），并设置 `process.exitCode = 1`。

### 4.2 常量（`src/constants/index.ts`）

- **API**：`API_BASE_URL`（open.popo.netease.com）、`AUTH_API_PATH`（/open-apis/token）。
- **任务轮询**：`DEFAULT_POLLING_MAX_ATTEMPTS`、`DEFAULT_POLLING_INTERVAL_SEC`、`TASK_STATUS_*`。
- **本地配置**：`CONFIG_FILENAME`（popo-doc-config.json）。
- **下载**：`DEFAULT_FILENAME_PREFIX`、`OPENCLAW_SKILL_NAME` 等。

便于重构时集中调整环境（如测试/生产域名、轮询策略）。

### 4.3 认证（`api/auth.ts`）

- `getAccessToken()`：对外唯一入口；先查内存缓存与本地配置，失败则调 `getToken()`。
- `getToken()`：使用 `POPO_APP_ID` / `POPO_APP_SECRET` 调 POPO token 接口，成功后 `setLocalConfig` 并写缓存。
- 过期判断：`cachedExpiredAt > now + 1000`（提前 1 秒视为有效）。

### 4.4 请求封装（`utils/request.ts`）

- `request<T>(url, options, errorContext)`：统一 `fetch`、解析 JSON、检查 `errcode`（0 或未设置通过；6008 映射为「没有文档的权限」）、取 `data` 作为返回值。
- 所有 Open API 的调用均建议经此方法，便于统一错误处理和后续重试/日志改造。

### 4.5 URL 解析（`utils/parse-url.ts`）

- `parseUrl(url)` 返回：
  - 个人：`{ type: "personal", docId }`（支持 `docs.popo.netease.com`、`doc.netease.com`，路径 `/lingxi/{id}` 或 `/docs/{id}`）。
  - 团队：`{ type: "team", teamSpaceKey, pageId }`（路径 `/team/pc/{teamSpaceKey}/pageDetail/{pageId}`）。
- 不匹配或 host 不在白名单则抛错，错误信息中给出期望格式，便于排查。

### 4.6 下载（`utils/download-file.ts`）

- `downloadFile(url, outputDir, suggestedName?)`：创建目录、`fetch` URL、根据 URL 或 `Content-Type` 推断扩展名、生成文件名（无则用默认前缀+时间戳）、写入磁盘，返回本地绝对路径。
- 扩展名逻辑集中在一处，后续支持新类型时可只改此模块。

### 4.7 任务轮询（`utils/task.ts`）

- `pollTaskResult(taskId, maxAttempts, intervalSec)`：轮询 `open-apis/drive/v1/task?taskId=xxx`，直到 `taskCompleteStatus === 1` 且 `taskStatus === 200`，返回 `taskExtra`（下载链接）；超时或失败抛错。
- 个人/团队「导出」类接口会先返回 taskId，再由本函数轮询得到下载链接，供 `downloadFile` 使用。

### 4.8 个人文档 API（`api/document/personal.ts`）

- `getPersonalDocDetail(docId)`：获取文档详情（name、docType 等）。
- `getPersonalFileUrl(docId)`：获取访问 URL。
- `searchPersonalDocuments(searchContent, page, size, searchId)`：搜索，返回 total/page/size/list/searchId/hasMore。
- `downloadPersonalFile(docId)`：直接下载（非在线文档，如 docType=3）。
- `exportPersonalDocument(docId, outputType?)`：发起导出任务，返回 taskId。

### 4.9 团队空间 API（`api/document/team.ts`）

- `getTeamPageDetail(teamSpaceKey, pageId)`：页面详情（pageName、pageStatus、pageType）。
- `exportTeamDocument(teamSpaceKey, pageId, outputType?)`：发起导出，返回 taskId。
- `downloadTeamPageFile(teamSpaceKey, pageId)`：直接下载页面文件。

### 4.10 本地配置（`utils/local-config.ts`）

- 路径：用户主目录下的 `CONFIG_FILENAME`（popo-doc-config.json）。
- `getLocalConfig()`：读文件并校验 `openAccessToken`、`accessExpiredAt`，内存缓存。
- `setLocalConfig(config)`：校验后写入并更新缓存。
- 被 `auth.ts` 用于 Token 持久化与读取。

### 4.11 日志与错误输出（`utils/log.ts`）

- `log(message, data?, type?)`：仅当 `DEBUG=true` 时输出，便于生产静默、调试时打开。
- `printCommandError(command, args, error)`：命令失败时统一输出错误 JSON 并设置 exitCode，与 `--json` 行为一致。

---

## 5. 使用方式（与 README 对齐）

### 5.1 环境与认证（当前代码行为）

- **方式 A**：在用户主目录放置 `popo-doc-config.json`，包含有效的 `openAccessToken`、`accessExpiredAt`（毫秒时间戳）。
- **方式 B**：设置环境变量 `POPO_APP_ID`、`POPO_APP_SECRET`，首次调用时会拉取 Token 并写入方式 A 的配置文件。
- 调试时可选：`DEBUG=true popo-doc <command> ...` 查看内部日志。

**注意**：若 README 中 LANGBASE 方式为实际标准，需在代码中实现对应认证并更新本文档与 README。

### 5.2 安装与命令

```bash
npm i -g popo-doc-cli
```

- 下载文档：`popo-doc download -u "<文档 URL>" [-o 输出目录] [--json]`
- 搜索文档：`popo-doc search -q "关键词" [-p 页码] [-s 每页条数] [--search-id xxx] [--json]`
- 获取 URL：`popo-doc url -d <docId> [--json]`

支持的 URL格式：

- 个人：`https://docs.popo.netease.com/lingxi/{docId}` 或 `/docs/{docId}`（host 含 doc.netease.com 亦可）。
- 团队：`https://docs.popo.netease.com/team/pc/{teamSpaceKey}/pageDetail/{pageId}`。

### 5.3 输出约定

- 成功：`success: true`，`data` 中为业务数据（如 localPath、downloadUrl、docName、列表等）。
- 失败：`success: false`，`error` 为错误信息；`printCommandError` 会视 `args.json` 决定是否额外打印简短文案。
- `--json`：仅输出 JSON，便于脚本解析。

---

## 6. 重构、交接与优化建议

### 6.1 架构与可维护性

- **认证与 README 一致化**：若生产使用 LANGBASE_TOKEN + langbase 认证接口，建议在 `api/auth.ts` 中增加该链路（或独立 auth 策略），并更新 README 与本文「认证」小节。
- **配置集中**：继续用 `constants` 管理 API 基址、轮询参数；可考虑通过环境变量覆盖（如 `POPO_API_BASE_URL`），便于多环境与测试。
- **错误码与重试**：`request.ts` 中已对 errcode 6008 做语义化；可在此统一扩展错误码映射，并可选增加重试（如 5xx/网络错误）。
- **类型**：个人/团队接口返回多为 `Record<string, unknown>`，交接后可为关键 API 定义接口类型，减少运行时类型隐患。

### 6.2 测试与质量

- 为 `parseUrl`、`downloadFile`（扩展名逻辑）、`docTypeName`/`shareTypeName` 等纯函数补充单元测试。
- 对 `request`、`auth`、`task` 可做集成测试或 Mock 服务器测试，保证与 Open API 契约一致。
- 发布前已配 `prepublishOnly`（build + typecheck），可考虑增加 `npm test`（如 lint + 单测）。

### 6.3 构建与发布

- 当前仅发布 `dist` 目录，源码不发布；构建由 tsup 单入口生成 ESM，带 shebang，可直接作为 bin 使用。
- 发布公网 npm 见 `docs/NPM_PUBLISH.md`（2FA/Token 等）。

### 6.4 安全与运维

- Token 与本地配置文件属敏感信息，文档中应提醒勿提交、勿外泄；若支持从环境变量读取 Token，需说明优先级与过期策略。
- 日志中避免打印完整 Token；当前 `log` 仅在 DEBUG 下输出，可保持并审查新增日志内容。

### 6.5 功能扩展方向

- 支持更多 URL 形式或域名白名单（在 `parse-url.ts` 扩展）。
- 下载支持断点续传、并发数限制（在 `download-file.ts` 或新模块）。
- 团队空间搜索、列表等（若 Open API 支持，可在 `api/document/team.ts` 扩展）。

---

## 7. 依赖与构建摘要

- **生产依赖**：commander（CLI 解析）。
- **开发依赖**：typescript、tsup、@types/node、cross-env。
- **构建**：`npm run build`（tsup）→ `dist/index.js` + sourcemap；`npm run typecheck` 仅类型检查。
- **运行**：Node 直接执行 `dist/index.js` 或通过 bin `popo-doc` 调用。

---

文档版本与代码对应关系建议在重大重构后更新本文「项目概览」与「认证」等小节，并同步 README。
