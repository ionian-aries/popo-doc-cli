# popo-doc-cli

POPO 文档命令行工具（Node.js 版），支持下载、搜索、获取文档 URL。

## 配置方式

每次执行工具都会通过认证接口获取配置，不使用 `APP_ID`/`APP_SECRET` 环境变量。

必需环境变量：

- `LANGBASE_TOKEN`：格式 `appId.appKey`

认证接口（固定）：

- `POST https://langbase.netease.com/api/langbase/openclaw/service/auth`
- body: `{ "token": "<LANGBASE_TOKEN>", "serviceName": "popo-doc" }`

## 安装

```bash
npm i -g popo-doc-cli
```

安装后可使用 `popo-doc`（同时兼容 `popo-docs`）。

## 命令

### 1) 下载文档

```bash
popo-doc download -u "https://docs.popo.netease.com/lingxi/{docId}" -o ./downloads --json
```

### 2) 搜索文档

```bash
popo-doc search -q "技术文档" -p 1 -s 10 --json
popo-doc search --query "周报" --page 2 --search-id <上一页返回的searchId> --json
```

### 3) 获取文档 URL

```bash
popo-doc url -d <docId> --json
```

## 开发

```bash
npm install
npm run build
npm run typecheck
```
