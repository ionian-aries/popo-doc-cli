import { getAccessToken } from "../api/auth.ts";
import {
  API_BASE_URL,
  DEFAULT_POLLING_INTERVAL_SEC,
  DEFAULT_POLLING_MAX_ATTEMPTS,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_SUCCESS,
} from "../constants/index.ts";
import { log } from "./log.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollTaskResult(
  taskId: string,
  maxAttempts = DEFAULT_POLLING_MAX_ATTEMPTS,
  intervalSec = DEFAULT_POLLING_INTERVAL_SEC
): Promise<string> {
  const token = await getAccessToken();
  const url = new URL(`${API_BASE_URL}/open-apis/drive/v1/task`);
  url.searchParams.set("taskId", taskId);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    log(`Polling attempt ${attempt + 1}/${maxAttempts}`, { taskId });
    try {
      const response = await fetch(url, {
        headers: {
          "Open-Access-Token": token,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Task query failed: ${response.statusText}`);
      }
      const result = (await response.json()) as Record<string, unknown>;
      const errcode = Number(result.errcode ?? 0);
      if (errcode !== 0) {
        throw new Error(
          `Task query failed: ${String(
            result.errmsg ?? "Unknown"
          )} (errcode: ${String(result.errcode ?? "")})`
        );
      }

      const task = (result.data as Record<string, unknown> | undefined) ?? null;
      if (!task) {
        throw new Error("Task response missing data");
      }

      const taskCompleteStatus = Number(task.taskCompleteStatus ?? -1);
      const taskStatus = Number(task.taskStatus ?? -1);
      log("Task status", { taskId, taskCompleteStatus, taskStatus });

      if (taskCompleteStatus !== TASK_STATUS_COMPLETED) {
        if (attempt < maxAttempts - 1) {
          await sleep(intervalSec * 1000);
        }
        continue;
      }

      if (taskStatus === TASK_STATUS_SUCCESS) {
        const downloadUrl = String(task.taskExtra ?? "");
        if (!downloadUrl) {
          throw new Error("Task completed but download URL is missing");
        }
        log("Task completed successfully", { taskId, downloadUrl });
        return downloadUrl;
      }

      throw new Error(
        `Task failed: ${String(task.taskDesc ?? "Unknown")} (status: ${String(
          task.taskStatus ?? ""
        )})`
      );
    } catch (error) {
      log(
        "Polling error (will retry)",
        {
          taskId,
          error: error instanceof Error ? error.message : String(error),
        },
        "error"
      );
      if (attempt >= maxAttempts - 1) {
        throw new Error(
          `Task polling failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      await sleep(intervalSec * 1000);
    }
  }

  throw new Error(
    `Task timeout: The export operation did not complete within ${
      maxAttempts * intervalSec
    }s`
  );
}
