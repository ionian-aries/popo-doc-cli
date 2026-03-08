import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONFIG_FILENAME } from "../constants/index.ts";

let cachedLocalConfig: Record<string, unknown> | null = null;

function getConfigPath(): string {
  const home =
    process.env.HOME ?? process.env.USERPROFILE ?? process.env.HOMEPATH ?? "";
  if (!home) throw new Error("无法获取用户主目录");
  return path.join(home, CONFIG_FILENAME);
}

function assertValidTokenConfig(config: Record<string, unknown>): void {
  const { openAccessToken, accessExpiredAt } = config;
  if (
    typeof openAccessToken !== "string" ||
    !openAccessToken.trim() ||
    accessExpiredAt == null ||
    Number.isNaN(Number(accessExpiredAt))
  ) {
    throw new Error("本地配置须包含有效的 openAccessToken 与 accessExpiredAt");
  }
}

export async function getLocalConfig(): Promise<Record<string, unknown>> {
  if (cachedLocalConfig) return cachedLocalConfig;
  const p = getConfigPath();
  try {
    const config = JSON.parse(await readFile(p, "utf-8")) as Record<
      string,
      unknown
    >;
    assertValidTokenConfig(config);
    cachedLocalConfig = config;
    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error(`配置文件不存在: ${p}`);
    }
    throw err;
  }
}

export async function setLocalConfig(
  config: Record<string, unknown>
): Promise<void> {
  try {
    assertValidTokenConfig(config);
    const p = getConfigPath();
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(config, null, 2), "utf-8");
    cachedLocalConfig = config;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`写入本地配置失败: ${msg}`);
  }
}
