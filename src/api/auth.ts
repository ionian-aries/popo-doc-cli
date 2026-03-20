import {
  AUTH_API_PATH,
  API_BASE_URL,
  TOKEN_REFRESH_BUFFER_MS,
} from "../constants/index.ts";
import { getLocalConfig, setLocalConfig, log } from "../utils";

let cachedToken: string | null = null;
let cachedExpiredAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  const buffer = TOKEN_REFRESH_BUFFER_MS;

  // 1. 内存缓存未过期
  if (cachedToken && cachedExpiredAt > now + buffer) {
    log("Using cached token", { expiresAt: cachedExpiredAt });
    return cachedToken;
  }

  try {
    const local = await getLocalConfig();
    const token = local.openAccessToken as string;
    const expiresAt = Number(local.accessExpiredAt);

    // 2. 本地 token 未过期（含缓冲）
    if (expiresAt > now + buffer) {
      cachedToken = token;
      cachedExpiredAt = expiresAt;
      log("Using token from local config", { expiresAt });
      return token;
    }

    // 3. 本地 token 已过期或即将过期，自动刷新并写入本地
    log("Local token expired or about to expire, refreshing", { expiresAt });
    return getToken();
  } catch {
    // 4. 本地配置不可用，拉新 token 并写入本地
    return getToken();
  }
}

async function getToken(): Promise<string> {
  const { POPO_APP_ID: appId, POPO_APP_SECRET: appSecret } = process.env;
  if (!appId || !appSecret) {
    throw new Error("请设置环境变量: POPO_APP_ID 和 POPO_APP_SECRET");
  }

  const url = `${API_BASE_URL}${AUTH_API_PATH}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, appSecret }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (Number(data.errcode ?? -1) !== 0) {
    throw new Error(
      `Token request failed: ${String(
        data.errmsg ?? "Unknown"
      )} (errcode: ${String(data.errcode ?? "")})`
    );
  }

  const payload = (data.data as Record<string, unknown> | undefined) ?? {};
  const token = String(payload.openAccessToken ?? "");
  const expiresAt = Number(payload.accessExpiredAt ?? 0);
  if (!token) {
    throw new Error("Token response missing openAccessToken");
  }
  await setLocalConfig(payload);
  cachedToken = token;
  cachedExpiredAt = expiresAt;
  log("Token refreshed successfully", { expiresAt: cachedExpiredAt });
  return token;
}
