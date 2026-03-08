import { log } from "./log.ts";

type ParsedDocumentUrl =
  | { type: "personal"; docId: string }
  | { type: "team"; teamSpaceKey: string; pageId: string };

export function parseUrl(url: string): ParsedDocumentUrl {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!["docs.popo.netease.com", "doc.netease.com"].includes(hostname)) {
      throw new Error(
        "Invalid hostname. Expected docs.popo.netease.com or doc.netease.com"
      );
    }

    const path = parsed.pathname;
    const personal = path.match(/^\/(?:lingxi|docs)\/([a-zA-Z0-9_-]+)$/);
    if (personal) {
      const out: ParsedDocumentUrl = { type: "personal", docId: personal[1] };
      log("Parsed as personal document", out);
      return out;
    }

    const team = path.match(
      /^\/team\/pc\/([a-zA-Z0-9_-]+)\/pageDetail\/([a-zA-Z0-9_-]+)$/
    );
    if (team) {
      const out: ParsedDocumentUrl = {
        type: "team",
        teamSpaceKey: team[1],
        pageId: team[2],
      };
      log("Parsed as team space document", out);
      return out;
    }

    throw new Error(
      "URL does not match expected format.\n" +
        "Expected formats:\n" +
        "  - Personal: https://docs.popo.netease.com/lingxi/{docId}\n" +
        "  - Team Space: https://docs.popo.netease.com/team/pc/{teamSpaceKey}/pageDetail/{pageId}\n"
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error(`Failed to parse URL: ${String(error)}`);
  }
}
