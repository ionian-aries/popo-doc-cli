export function log(
  message: string,
  data?: Record<string, unknown>,
  type: "log" | "error" = "log"
): void {
  if (process.env.DEBUG !== "true") return;
  const fn = type === "error" ? console.error : console.log;
  fn("[DEBUG]", message, data ?? "");
}

/** 命令失败时统一输出错误结果（不受 DEBUG 控制，始终打印） */
export function printCommandError(
  command: "download" | "search" | "url" | "info",
  args: { json?: boolean; url?: string; query?: string; docId?: string },
  error: unknown
): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const result: Record<string, unknown> = { success: false, error: errMsg };
  if (command === "download" || command === "info") {
    result.url = args.url ?? "";
  } else if (command === "search") {
    result.searchContent = args.query ?? "";
  } else {
    result.docId = args.docId ?? "";
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error("错误:", errMsg);
    console.log(JSON.stringify(result, null, 2));
  }
  process.exitCode = 1;
}
