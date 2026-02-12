import type { BridgeMessage, BridgeToolCall, BridgeToolResult } from "@webviewmcp/protocol";

import type { ContentToolRequest, ContentToolResponse } from "../shared/messages.js";
import { getWebExtensionApi, type Tab } from "../shared/webext.js";

const BRIDGE_URL = "ws://127.0.0.1:8788/bridge";

function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    return JSON.parse(raw) as BridgeMessage;
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

async function asText(value: unknown): Promise<string | null> {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Blob) {
    return await value.text();
  }

  return null;
}

function serializeTab(tab: Tab): Record<string, unknown> {
  return {
    tabId: tab.id ?? null,
    title: tab.title ?? "",
    url: tab.url ?? "",
    active: Boolean(tab.active),
    windowId: tab.windowId ?? null,
  };
}

async function handleToolCall(api: ReturnType<typeof getWebExtensionApi>, call: BridgeToolCall): Promise<unknown> {
  if (call.name === "tabs.list") {
    const tabs = await api.tabs.query({});
    return { tabs: tabs.map(serializeTab) };
  }

  if (call.name === "page.screenshot") {
    const tabId = asNumber(call.args.tabId);
    if (tabId === null) {
      throw new Error("tabId is required");
    }

    const tabs = await api.tabs.query({});
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (!tab || tab.windowId === undefined) {
      throw new Error("tab not found");
    }

    const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const content = dataUrl.split(",").at(1) ?? "";

    return {
      mimeType: "image/png",
      base64: content,
    };
  }

  const tabId = asNumber(call.args.tabId);
  if (tabId === null) {
    throw new Error("tabId is required");
  }

  const frameId = asNumber(call.args.frameId) ?? 0;
  const message: ContentToolRequest = {
    type: "mcp_tool",
    name: call.name,
    args: call.args,
  };

  const response = (await api.tabs.sendMessage(tabId, message, { frameId })) as ContentToolResponse;
  if (!response || response.ok !== true) {
    throw new Error(response?.error ?? "Content script action failed");
  }

  return response.result ?? { ok: true };
}

function sendResult(socket: WebSocket, payload: BridgeToolResult): void {
  socket.send(JSON.stringify(payload));
}

function connectBridge(): void {
  const api = getWebExtensionApi();
  const socket = new WebSocket(BRIDGE_URL);

  socket.addEventListener("message", async (event) => {
    const raw = await asText(event.data);
    if (!raw) {
      return;
    }

    const parsed = parseBridgeMessage(raw);
    if (!parsed || parsed.type !== "tool_call") {
      return;
    }

    try {
      const result = await handleToolCall(api, parsed);
      sendResult(socket, {
        id: parsed.id,
        type: "tool_result",
        ok: true,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendResult(socket, {
        id: parsed.id,
        type: "tool_result",
        ok: false,
        error: message,
      });
    }
  });

  socket.addEventListener("close", () => {
    setTimeout(() => connectBridge(), 1_000);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

connectBridge();
