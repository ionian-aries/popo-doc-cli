import { API_BASE_URL } from "../../constants/index.ts";
import { log, request } from "../../utils/index.ts";
import { getHeaders } from "../shared.ts";

export interface SearchResult {
  total: number;
  page: number;
  size: number;
  list: Array<Record<string, unknown>>;
  searchId: string;
  hasMore: boolean;
}

// 查询个人文件详情
export async function getPersonalDocDetail(
  docId: string
): Promise<Record<string, unknown>> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive/v1/doc`);
  url.searchParams.set("docId", docId);

  const detail = await request(
    url,
    { headers: await getHeaders() },
    "查询个人文件详情失败！"
  );
  log("查询个人文件详情：", {
    docId,
    name: detail.name,
    docType: detail.docType,
  });
  return detail;
}

// 获取文件访问 url
export async function getPersonalFileUrl(docId: string): Promise<string> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive/v1/doc/url`);
  url.searchParams.set("docId", docId);

  const docUrl = await request<string>(
    url,
    { headers: await getHeaders() },
    "获取文件访问 url失败"
  );
  log("获取文件访问 url:", { docId, url: docUrl });
  return docUrl;
}

// 搜索文件
export async function searchPersonalDocuments(
  searchContent: string,
  page = 1,
  size = 10,
  searchId?: string
): Promise<SearchResult> {
  const url = `${API_BASE_URL}/open-apis/drive/v1/doc/search`;
  const body: Record<string, string> = {
    searchContent,
    page: String(page),
    size: String(Math.min(size, 20)),
  };
  if (searchId) {
    body.searchId = searchId;
  }

  const headers = await getHeaders();
  const payload = await request<Record<string, unknown>>(
    url,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "搜索文件失败！"
  );

  const list =
    (payload.list as Array<Record<string, unknown>> | undefined) ?? [];
  const result: SearchResult = {
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? page),
    size: Number(payload.size ?? size),
    list,
    searchId: String(payload.searchId ?? ""),
    hasMore: Boolean(payload.hasMore),
  };
  log("搜索文件：", {
    total: result.total,
    page: result.page,
    count: result.list.length,
    hasMore: result.hasMore,
  });
  return result;
}

// 下载文件（不包含在线文档
export async function downloadPersonalFile(docId: string): Promise<string> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive/v1/doc/export`);
  url.searchParams.set("docId", docId);

  const downloadUrl = await request<string>(
    url,
    { headers: await getHeaders() },
    "下载文件（不包含在线文档）失败！"
  );
  log("下载文件（不包含在线文档）链接：", { downloadUrl });
  return downloadUrl;
}

// 导出灵犀文档表格
export async function exportPersonalDocument(
  docId: string,
  outputType?: number
): Promise<string> {
  const url = new URL(
    `${API_BASE_URL}/open-apis/drive/v1/doc/export/lingxiDoc`
  );
  url.searchParams.set("docId", docId);
  if (outputType !== undefined) {
    url.searchParams.set("outputType", String(outputType));
  }

  const data = await request<{ id?: string | number }>(
    url,
    { headers: await getHeaders() },
    "导出灵犀文档表格失败！"
  );
  const taskId = data.id;
  if (taskId == null) {
    throw new Error("导出灵犀文档表格缺失taskId");
  }
  log("开始导出灵犀文档表格：", { taskId: String(taskId) });
  return String(taskId);
}
