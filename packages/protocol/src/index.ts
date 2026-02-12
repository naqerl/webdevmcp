export const TOOL_NAMES = [
  "tabs.list",
  "session.attach",
  "session.detach",
  "page.snapshot_dom",
  "page.query",
  "element.click",
  "element.type",
  "element.keypress",
  "page.scroll",
  "page.screenshot",
  "page.get_html",
  "page.wait_for",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: TParams;
}

export interface JsonRpcSuccess<TResult> {
  jsonrpc: "2.0";
  id: string | number | null;
  result: TResult;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<TResult> = JsonRpcSuccess<TResult> | JsonRpcError;

export interface ToolsCallParams {
  name: ToolName;
  arguments: Record<string, unknown>;
}

export interface ToolDescriptor {
  name: ToolName;
  description: string;
}

export interface InitializeResult {
  name: string;
  version: string;
  protocolVersion: string;
}

export interface ToolsListResult {
  tools: ToolDescriptor[];
}

export interface SessionRef {
  tabId: number;
  frameId: number;
}

export interface BridgeToolCall {
  id: string;
  type: "tool_call";
  name: ToolName;
  args: Record<string, unknown>;
}

export interface BridgeToolResult {
  id: string;
  type: "tool_result";
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type BridgeMessage = BridgeToolCall | BridgeToolResult;

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOL_NAMES.includes(value as ToolName);
}

export function createJsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

export function createToolDescriptors(): ToolDescriptor[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: `Tool ${name}`,
  }));
}
