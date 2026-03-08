import { API_BASE_URL } from "../../constants/index.ts";
import { log, request } from "../../utils/index.ts";
import { getHeaders } from "../shared.ts";

// 团队空间
// 获取页面详情信息
export async function getTeamPageDetail(
  teamSpaceKey: string,
  pageId: string
): Promise<Record<string, unknown>> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive-space/v1/page/detail`);
  url.searchParams.set("teamSpaceKey", teamSpaceKey);
  url.searchParams.set("pageId", pageId);

  const detail = await request(
    url,
    { headers: await getHeaders() },
    "团队空间-获取页面详情信息失败！"
  );
  log("团队空间-获取页面详情信息：", {
    teamSpaceKey,
    pageId,
    pageName: detail.pageName,
  });
  return detail;
}

// 导出页面（灵犀文档/表格/Markdown
export async function exportTeamDocument(
  teamSpaceKey: string,
  pageId: string,
  outputType?: number
): Promise<string> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive-space/v1/page/export`);
  url.searchParams.set("teamSpaceKey", teamSpaceKey);
  url.searchParams.set("pageId", pageId);
  url.searchParams.set("exportType", "1");
  if (outputType !== undefined) {
    url.searchParams.set("outputType", String(outputType));
  }

  const data = await request<{ id?: string | number }>(
    url,
    { headers: await getHeaders() },
    "团队空间-导出页面（灵犀文档/表格/Markdown）失败！"
  );
  const taskId = data.id;
  if (taskId == null) {
    throw new Error("团队空间-导出页面（灵犀文档/表格/Markdown）缺失taskId");
  }
  log("开始导出团队空间-导出页面（灵犀文档/表格/Markdown）", {
    taskId: String(taskId),
  });
  return String(taskId);
}

// 下载页面（文件类型)
export async function downloadTeamPageFile(
  teamSpaceKey: string,
  pageId: string
): Promise<string> {
  const url = new URL(`${API_BASE_URL}/open-apis/drive-space/v1/page/download`);
  url.searchParams.set("teamSpaceKey", teamSpaceKey);
  url.searchParams.set("pageId", pageId);

  const downloadUrl = await request<string>(
    url,
    { headers: await getHeaders() },
    "团队空间-下载页面失败："
  );
  log("团队空间-下载页面链接：", { downloadUrl });
  return downloadUrl;
}
