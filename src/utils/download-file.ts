import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_FILENAME_PREFIX } from "../constants/index.ts";
import { log } from "./log.ts";

function extFromUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    const match = parsed.pathname.match(/\.([a-z0-9]{2,4})(?:$|\?)/i);
    return match ? `.${match[1].toLowerCase()}` : "";
  } catch {
    return "";
  }
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return ".bin";
  const ct = contentType.toLowerCase();
  if (ct.includes("application/pdf")) return ".pdf";
  if (ct.includes("word") || ct.includes("msword") || ct.includes("wordprocessingml")) return ".docx";
  if (ct.includes("excel") || ct.includes("spreadsheetml") || ct.includes("ms-excel")) return ".xlsx";
  if (ct.includes("powerpoint") || ct.includes("presentationml")) return ".pptx";
  if (ct.includes("markdown") || ct.includes("text/md")) return ".md";
  if (ct.includes("text/plain")) return ".txt";
  if (ct.includes("text/csv")) return ".csv";
  if (ct.includes("application/zip")) return ".zip";
  if (ct.includes("image/jpeg")) return ".jpg";
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/gif")) return ".gif";
  return ".bin";
}

function hasFileExt(filename: string): boolean {
  return /\.[a-z0-9]{2,4}$/i.test(filename);
}

export async function downloadFile(
  url: string,
  outputDir: string,
  suggestedName?: string
): Promise<string> {
  log("Starting file download", { url, outputDir, suggestedName });
  await mkdir(outputDir, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  let ext = extFromUrl(url) || extFromContentType(contentType);
  let filename = suggestedName?.trim() ?? "";
  if (!filename) {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.replace(/\/$/, "").split("/");
      const tail = segments[segments.length - 1] ?? "";
      if (tail.includes(".")) {
        filename = tail;
        ext = "";
      }
    } catch {
      // ignore parse error
    }
  }

  if (!filename) {
    filename = `${DEFAULT_FILENAME_PREFIX}_${Date.now()}${ext}`;
  } else if (ext && !hasFileExt(filename)) {
    filename = `${filename}${ext}`;
  }

  const filepath = path.join(outputDir, filename);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filepath, bytes);
  log("File saved successfully", { filepath });
  return filepath;
}
