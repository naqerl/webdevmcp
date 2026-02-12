import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  createJsonRpcError,
  createToolDescriptors,
  isToolName,
  type InitializeResult,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type SessionRef,
  type ToolName,
  type ToolsCallParams,
  type ToolsListResult,
} from "@webviewmcp/protocol";

import { SessionStore } from "./sessionStore.js";

const JSON_CONTENT_TYPE = "application/json";

export interface ToolDispatcher {
  dispatch: (name: ToolName, args: Record<string, unknown>) => Promise<unknown>;
}

export interface McpServerOptions {
  dispatcher: ToolDispatcher;
  sessionStore?: SessionStore;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": JSON_CONTENT_TYPE });
  response.end(JSON.stringify(body));
}

async function parseBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.length === 0) {
    return null;
  }

  return JSON.parse(rawBody) as unknown;
}

function initializeResult(): InitializeResult {
  return {
    name: "webviewmcp",
    version: "0.1.0",
    protocolVersion: "2025-06-18",
  };
}

function toolsListResult(): ToolsListResult {
  return {
    tools: createToolDescriptors(),
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function readSessionArgument(args: Record<string, unknown>): string | null {
  const sessionId = args["sessionId"];
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return null;
  }

  return sessionId;
}

function parseAttachArguments(args: Record<string, unknown>): SessionRef | null {
  const tabId = args["tabId"];
  const frameId = args["frameId"] ?? 0;

  if (typeof tabId !== "number" || !Number.isInteger(tabId)) {
    return null;
  }

  if (typeof frameId !== "number" || !Number.isInteger(frameId)) {
    return null;
  }

  return { tabId, frameId };
}

export async function handleJsonRpc(
  request: JsonRpcRequest,
  options: McpServerOptions,
): Promise<JsonRpcResponse<unknown>> {
  const { id, method } = request;

  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: initializeResult() };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: toolsListResult() };
  }

  if (method !== "tools/call") {
    return createJsonRpcError(id, -32601, "Method not found");
  }

  const params = asObject(request.params);
  if (!params || !isToolName(params["name"])) {
    return createJsonRpcError(id, -32602, "Invalid params");
  }

  const callParams = params as ToolsCallParams;
  const args = asObject(callParams.arguments);
  if (!args) {
    return createJsonRpcError(id, -32602, "Invalid params");
  }

  const sessionStore = options.sessionStore;
  if (!sessionStore) {
    return createJsonRpcError(id, -32005, "Session store is not configured");
  }

  if (callParams.name === "session.attach") {
    const attachArgs = parseAttachArguments(args);
    if (!attachArgs) {
      return createJsonRpcError(id, -32602, "Invalid params");
    }

    const sessionId = sessionStore.attach(attachArgs.tabId, attachArgs.frameId);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        sessionId,
        tabId: attachArgs.tabId,
        frameId: attachArgs.frameId,
      },
    };
  }

  if (callParams.name === "session.detach") {
    const sessionId = readSessionArgument(args);
    if (!sessionId) {
      return createJsonRpcError(id, -32602, "Invalid params");
    }

    const ok = sessionStore.detach(sessionId);
    return { jsonrpc: "2.0", id, result: { ok } };
  }

  if (callParams.name !== "tabs.list") {
    const sessionId = readSessionArgument(args);
    if (!sessionId) {
      return createJsonRpcError(id, -32602, "sessionId is required");
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return createJsonRpcError(id, -32001, "Session not found");
    }

    args.tabId = session.tabId;
    args.frameId = session.frameId;
  }

  try {
    const result = await options.dispatcher.dispatch(callParams.name, args);
    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed";
    return createJsonRpcError(id, -32005, message);
  }
}

export function createMcpHttpServer(options: McpServerOptions): ReturnType<typeof createServer> {
  const sessionStore = options.sessionStore ?? new SessionStore();
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/mcp") {
      sendJson(response, 404, { message: "Not Found" });
      return;
    }

    try {
      const payload = (await parseBody(request)) as JsonRpcRequest;

      if (
        payload === null ||
        typeof payload !== "object" ||
        payload.jsonrpc !== "2.0" ||
        typeof payload.method !== "string" ||
        !("id" in payload)
      ) {
        sendJson(response, 400, createJsonRpcError(null, -32600, "Invalid Request"));
        return;
      }

      const result = await handleJsonRpc(payload, { ...options, sessionStore });
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 400, createJsonRpcError(null, -32700, "Parse error"));
    }
  });
}
