import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ToolName } from "@webviewmcp/protocol";
import { createMcpHttpServer } from "../../companion/src/server.js";

interface RecordedCall {
  name: ToolName;
  args: Record<string, unknown>;
}

describe("MCP HTTP server", () => {
  const calls: RecordedCall[] = [];

  const dispatcher = {
    dispatch: async (name: ToolName, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "tabs.list") {
        return {
          tabs: [{ tabId: 1, title: "Local", url: "https://example.com", active: true }],
        };
      }

      return { ok: true, echoed: args };
    },
  };

  const server = createMcpHttpServer({ dispatcher });
  let baseUrl = "";

  beforeEach(async () => {
    calls.length = 0;

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Server address unavailable");
        }

        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("responds to initialize", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "req-1", method: "initialize" }),
    });

    const json = (await response.json()) as { result: { name: string } };
    expect(response.status).toBe(200);
    expect(json.result.name).toBe("webviewmcp");
  });

  it("routes tabs.list to dispatcher", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-tabs",
        method: "tools/call",
        params: {
          name: "tabs.list",
          arguments: {},
        },
      }),
    });

    const json = (await response.json()) as { result: { tabs: Array<{ tabId: number }> } };
    expect(response.status).toBe(200);
    expect(json.result.tabs.at(0)?.tabId).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls.at(0)?.name).toBe("tabs.list");
  });

  it("creates a session and injects tabId/frameId into tool calls", async () => {
    const attachResponse = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-attach",
        method: "tools/call",
        params: {
          name: "session.attach",
          arguments: {
            tabId: 7,
            frameId: 0,
          },
        },
      }),
    });

    const attachJson = (await attachResponse.json()) as { result: { sessionId: string } };
    const sessionId = attachJson.result.sessionId;
    expect(sessionId.startsWith("s_")).toBe(true);

    const toolResponse = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-query",
        method: "tools/call",
        params: {
          name: "page.query",
          arguments: {
            sessionId,
            selector: "button",
          },
        },
      }),
    });

    const toolJson = (await toolResponse.json()) as { result: { ok: boolean } };
    expect(toolJson.result.ok).toBe(true);

    const queryCall = calls.find((call) => call.name === "page.query");
    expect(queryCall).toBeDefined();
    expect(queryCall?.args.tabId).toBe(7);
    expect(queryCall?.args.frameId).toBe(0);
  });
});
