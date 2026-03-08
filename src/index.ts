import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { Command } from "commander";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const pkg = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf-8")
) as { version: string };

import {
  parseUrl,
  downloadFile,
  log,
  pollTaskResult,
  docTypeName,
  shareTypeName,
  printCommandError,
} from "./utils";
import {
  downloadPersonalFile,
  downloadTeamPageFile,
  exportPersonalDocument,
  exportTeamDocument,
  getPersonalDocDetail,
  getPersonalFileUrl,
  getTeamPageDetail,
  searchPersonalDocuments,
} from "./api/document/index.ts";

type DownloadArgs = {
  url: string;
  outputDir?: string;
  json?: boolean;
};

type SearchArgs = {
  query: string;
  page?: string;
  size?: string;
  searchId?: string;
  json?: boolean;
};

type UrlArgs = {
  docId: string;
  json?: boolean;
};

async function cmdDownload(args: DownloadArgs): Promise<void> {
  if (args.outputDir) {
    process.env.OUTPUT_DIR = args.outputDir;
  }
  const outputDir = path.resolve(process.env.OUTPUT_DIR ?? "./assets");
  log("CLI download started", { url: args.url, outputDir });

  const parsed = parseUrl(args.url);
  let downloadUrl = "";
  let docName = "";
  let taskId: string | null = null;

  if (parsed.type === "personal") {
    const detail = await getPersonalDocDetail(parsed.docId);
    docName = String(detail.name ?? "");
    if (Number(detail.docType ?? 0) === 3) {
      downloadUrl = await downloadPersonalFile(parsed.docId);
    } else {
      taskId = await exportPersonalDocument(parsed.docId);
      downloadUrl = await pollTaskResult(taskId);
    }
  } else {
    const detail = await getTeamPageDetail(parsed.teamSpaceKey, parsed.pageId);
    docName = String(detail.pageName ?? "");
    if (Number(detail.pageStatus ?? -1) !== 0) {
      throw new Error(
        `Page is not available (status: ${String(detail.pageStatus ?? "")})`
      );
    }
    if (Number(detail.pageType ?? 0) === 3) {
      downloadUrl = await downloadTeamPageFile(
        parsed.teamSpaceKey,
        parsed.pageId
      );
    } else {
      const outputType = Number(detail.pageType ?? 0) === 4 ? 41 : undefined;
      taskId = await exportTeamDocument(
        parsed.teamSpaceKey,
        parsed.pageId,
        outputType
      );
      downloadUrl = await pollTaskResult(taskId);
    }
  }

  const localPath = await downloadFile(downloadUrl, outputDir, docName);
  const result: Record<string, unknown> = {
    success: true,
    message: "Document downloaded successfully",
    data: {
      localPath,
      originalUrl: args.url,
      downloadUrl,
      docName,
    },
  };
  if (taskId) {
    (result.data as Record<string, unknown>).taskId = taskId;
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("下载成功:", localPath);
    console.log(JSON.stringify(result, null, 2));
  }
}

async function cmdSearch(args: SearchArgs): Promise<void> {
  const page = Math.max(1, Number.parseInt(args.page ?? "1", 10) || 1);
  const size = Math.min(
    20,
    Math.max(1, Number.parseInt(args.size ?? "10", 10) || 10)
  );
  const result = await searchPersonalDocuments(
    args.query,
    page,
    size,
    args.searchId
  );
  const output = {
    success: true,
    message: "Search completed successfully",
    data: {
      total: result.total,
      page: result.page,
      size: result.size,
      searchId: result.searchId,
      hasMore: result.hasMore,
      documents: result.list.map((d) => {
        const docType = Number(d.docType ?? 0);
        const shareType = Number(d.shareType ?? 0);
        return {
          docId: String(d.docId ?? ""),
          name: String(d.name ?? ""),
          docType,
          docTypeName: docTypeName(docType),
          externalType: Number(d.externalType ?? 0),
          shareType,
          shareTypeName: shareTypeName(shareType),
        };
      }),
    },
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`共 ${result.total} 条，当前页 ${result.list.length} 条`);
    console.log(JSON.stringify(output, null, 2));
  }
}

async function cmdUrl(args: UrlArgs): Promise<void> {
  const url = await getPersonalFileUrl(args.docId);
  const result = {
    success: true,
    message: "Document URL retrieved successfully",
    data: { docId: args.docId, url },
  };
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("URL:", url);
    console.log(JSON.stringify(result, null, 2));
  }
}

const program = new Command();

program.name("popo-doc").description("POPO 文档 CLI").version(pkg.version);

program
  .command("download")
  .alias("download-document")
  .description("下载 POPO 文档到本地")
  .requiredOption("-u, --url <url>", "POPO 文档 URL")
  .option("-o, --output-dir <dir>", "输出目录（默认 ./assets 或 OUTPUT_DIR）")
  .option("--json", "仅输出 JSON")
  .action(async (args: DownloadArgs) => {
    try {
      await cmdDownload(args);
    } catch (error) {
      printCommandError("download", args, error);
    }
  });

program
  .command("search")
  .alias("search-documents")
  .description("按关键词搜索个人文档")
  .requiredOption("-q, --query <query>", "搜索关键词")
  .option("-p, --page <page>", "页码", "1")
  .option("-s, --size <size>", "每页条数 (1-20)", "10")
  .option("--search-id <searchId>", "分页用 searchId")
  .option("--json", "仅输出 JSON")
  .action(async (args: SearchArgs) => {
    try {
      await cmdSearch(args);
    } catch (error) {
      printCommandError("search", args, error);
    }
  });

program
  .command("url")
  .alias("get-document-url")
  .description("获取个人文档访问 URL")
  .requiredOption("-d, --doc-id <docId>", "文档 ID (docId)")
  .option("--json", "仅输出 JSON")
  .action(async (args: UrlArgs) => {
    try {
      await cmdUrl(args);
    } catch (error) {
      printCommandError("url", args, error);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
