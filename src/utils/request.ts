interface ResponseBody<T> {
  data?: T;
  errcode?: number;
  errmsg?: string;
}

export async function request<T = Record<string, unknown>>(
  url: string | URL,
  options: {
    headers: Record<string, string>;
    method?: "GET" | "POST";
    body?: string;
  },
  errorContext: string
): Promise<T> {
  const { headers, method = "GET", body } = options;
  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined && { body }),
  });
  if (!response.ok) {
    throw new Error(`${errorContext}: ${response.statusText}`);
  }
  const data = (await response.json()) as ResponseBody<T>;
  checkErrcode(data, errorContext);
  if (data.data === undefined || data.data === null) {
    throw new Error(`${errorContext}: response is empty`);
  }
  return data.data;
}

function checkErrcode(
  data: { errcode?: number; errmsg?: string },
  defaultMsg: string = "资源校验失败"
): void {
  if (
    data.errcode === 0 ||
    data.errcode === undefined ||
    data.errcode === null
  ) {
    return;
  }
  if (data.errcode === 6008) {
    throw new Error("没有文档的权限");
  }
  throw new Error(defaultMsg);
}
