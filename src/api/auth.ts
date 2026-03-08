import { AUTH_API_PATH, API_BASE_URL } from "../constants/index.ts";
import { getLocalConfig, setLocalConfig, log } from "../utils";

let cachedToken: string | null = null;
let cachedExpiredAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedExpiredAt > now + 1000) {
    log("Using cached token", { expiresAt: cachedExpiredAt });
    return cachedToken;
  }

  try {
    const local = await getLocalConfig();
    const token = local.openAccessToken as string;
    const expiresAt = Number(local.accessExpiredAt);
    cachedToken = token;
    cachedExpiredAt = expiresAt;
    return token;
  } catch {
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
  setLocalConfig(payload)
  cachedToken = token;
  cachedExpiredAt = expiresAt;
  log("Token refreshed successfully", { expiresAt: cachedExpiredAt });
  return token;
}
