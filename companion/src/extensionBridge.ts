import { WebSocketServer, type WebSocket } from "ws";

import type { BridgeMessage, BridgeToolCall, BridgeToolResult, ToolName } from "@webviewmcp/protocol";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

const OPEN_STATE = 1;

export class ExtensionBridge {
  readonly #pending = new Map<string, PendingRequest>();
  readonly #wsServer: WebSocketServer;
  #socket: WebSocket | null = null;

  constructor(port: number) {
    this.#wsServer = new WebSocketServer({ host: "127.0.0.1", port, path: "/bridge" });
    this.#wsServer.on("connection", (socket) => {
      this.#socket = socket;

      socket.on("message", (raw) => {
        this.#onMessage(raw.toString("utf8"));
      });

      socket.on("close", () => {
        if (this.#socket === socket) {
          this.#socket = null;
        }
      });
    });
  }

  async dispatch(name: ToolName, args: Record<string, unknown>): Promise<unknown> {
    const socket = this.#socket;
    if (!socket || socket.readyState !== OPEN_STATE) {
      throw new Error("Extension is not connected");
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const payload: BridgeToolCall = {
      id,
      type: "tool_call",
      name,
      args,
    };

    return await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error("Extension request timed out"));
      }, 30_000);

      this.#pending.set(id, {
        resolve,
        reject,
        timeout,
      });

      socket.send(JSON.stringify(payload), (error) => {
        if (!error) {
          return;
        }

        clearTimeout(timeout);
        this.#pending.delete(id);
        reject(error);
      });
    });
  }

  close(): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Extension bridge shutting down"));
    }

    this.#pending.clear();
    this.#wsServer.close();
  }

  #onMessage(raw: string): void {
    let message: BridgeMessage;

    try {
      message = JSON.parse(raw) as BridgeMessage;
    } catch {
      return;
    }

    if (message.type !== "tool_result") {
      return;
    }

    const pending = this.#pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.#pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result ?? null);
      return;
    }

    pending.reject(new Error(message.error ?? "Tool call failed"));
  }
}
