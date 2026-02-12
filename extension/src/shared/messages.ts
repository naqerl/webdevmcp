import type { ToolName } from "@webviewmcp/protocol";

export interface ContentToolRequest {
  type: "mcp_tool";
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ContentToolResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function isContentToolRequest(value: unknown): value is ContentToolRequest {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.type === "mcp_tool" &&
    typeof record.name === "string" &&
    record.args !== null &&
    typeof record.args === "object"
  );
}
