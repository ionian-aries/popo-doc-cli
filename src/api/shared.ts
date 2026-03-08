import { getAccessToken } from "./auth.ts";

export async function getHeaders(): Promise<Record<string, string>> {
  return {
    "Open-Access-Token": await getAccessToken(),
    "Content-Type": "application/json",
  };
}
