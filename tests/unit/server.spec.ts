import { describe, expect, it } from "vitest";

import type { JsonRpcRequest, ToolName } from "@webviewmcp/protocol";
import { handleJsonRpc } from "../../companion/src/server.js";
import { SessionStore } from "../../companion/src/sessionStore.js";

describe("handleJsonRpc", () => {
  it("returns method not found for unknown methods", async () => {
    const sessionStore = new SessionStore();
    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "x",
        method: "unknown",
      } as JsonRpcRequest,
      {
        dispatcher: {
          dispatch: async () => ({ ok: true }),
        },
        sessionStore,
      },
    );

    if (!("error" in response)) {
      throw new Error("Expected error response");
    }

    expect(response.error.code).toBe(-32601);
  });

  it("requires an existing session for tab-bound tools", async () => {
    const sessionStore = new SessionStore();

    const response = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: "q1",
        method: "tools/call",
        params: {
          name: "page.query" as ToolName,
          arguments: { sessionId: "missing", selector: "button" },
        },
      },
      {
        dispatcher: {
          dispatch: async () => ({ ok: true }),
        },
        sessionStore,
      },
    );

    if (!("error" in response)) {
      throw new Error("Expected error response");
    }

    expect(response.error.code).toBe(-32001);
  });
});
