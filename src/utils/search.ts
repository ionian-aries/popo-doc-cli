export function docTypeName(docType: number): string {
  const names: Record<number, string> = {
    1: "Document (Word)",
    2: "Spreadsheet (Excel)",
    3: "File",
    4: "Markdown",
  };
  return names[docType] ?? `Unknown (${docType})`;
}

export function shareTypeName(shareType: number): string {
  const names: Record<number, string> = {
    0: "Not Shared",
    1: "Read Only",
    2: "Read & Edit",
  };
  return names[shareType] ?? `Unknown (${shareType})`;
}
