import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { ExtensionBridge } from "../../companion/src/extensionBridge.js";
import { createMcpHttpServer } from "../../companion/src/server.js";
import { createTestAppServer } from "./helpers/testAppServer.js";

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: string;
  error: {
    code: number;
    message: string;
  };
}

type JsonRpcResult = JsonRpcSuccess | JsonRpcFailure;

function extensionBundlePath(): string {
  return resolve(process.cwd(), "extension");
}

async function postMcp(baseUrl: string, body: Record<string, unknown>): Promise<JsonRpcResult> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  return (await response.json()) as JsonRpcResult;
}

function isSuccess(result: JsonRpcResult): result is JsonRpcSuccess {
  return "result" in result;
}

async function waitForBridge(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: "tabs-list",
      method: "tools/call",
      params: {
        name: "tabs.list",
        arguments: {},
      },
    });

    if (isSuccess(response)) {
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Extension bridge did not connect");
}

describe("chromium extension e2e", () => {
  const extensionEnabled = process.env.E2E_RUN_EXTENSION === "1";

  it.skipIf(!extensionEnabled)("drives a real page over MCP HTTP through extension", async () => {
    const extensionPath = extensionBundlePath();
    const userDataDir = await mkdtemp(resolve(tmpdir(), "webviewmcp-e2e-"));
    const appServer = await createTestAppServer();

    const bridge = new ExtensionBridge(8788);
    const mcpServer = createMcpHttpServer({ dispatcher: bridge });

    await new Promise<void>((resolve) => {
      mcpServer.listen(8787, "127.0.0.1", () => resolve());
    });

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    try {
      const page = context.pages().at(0) ?? (await context.newPage());
      await page.goto(appServer.baseUrl, { waitUntil: "domcontentloaded" });

      await waitForBridge("http://127.0.0.1:8787");

      const tabsResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "tabs",
        method: "tools/call",
        params: {
          name: "tabs.list",
          arguments: {},
        },
      });

      if (!isSuccess(tabsResult)) {
        throw new Error(tabsResult.error.message);
      }

      const tabsPayload = tabsResult.result as {
        tabs: Array<{ tabId: number; url: string }>;
      };
      const targetTab = tabsPayload.tabs.find((tab) => tab.url.startsWith(appServer.baseUrl));
      if (!targetTab) {
        throw new Error("Failed to find target tab");
      }

      const attachResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "attach",
        method: "tools/call",
        params: {
          name: "session.attach",
          arguments: {
            tabId: targetTab.tabId,
            frameId: 0,
          },
        },
      });

      if (!isSuccess(attachResult)) {
        throw new Error(attachResult.error.message);
      }

      const attachPayload = attachResult.result as { sessionId: string };

      const typeResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "type",
        method: "tools/call",
        params: {
          name: "element.type",
          arguments: {
            sessionId: attachPayload.sessionId,
            selector: "[data-testid='item-input']",
            text: "via-mcp",
            clearFirst: true,
          },
        },
      });

      if (!isSuccess(typeResult)) {
        throw new Error(typeResult.error.message);
      }

      const clickResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "click",
        method: "tools/call",
        params: {
          name: "element.click",
          arguments: {
            sessionId: attachPayload.sessionId,
            selector: "[data-testid='add-btn']",
          },
        },
      });

      if (!isSuccess(clickResult)) {
        throw new Error(clickResult.error.message);
      }

      const queryResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "query",
        method: "tools/call",
        params: {
          name: "page.query",
          arguments: {
            sessionId: attachPayload.sessionId,
            selector: "[data-testid='item']",
          },
        },
      });

      if (!isSuccess(queryResult)) {
        throw new Error(queryResult.error.message);
      }

      const queryPayload = queryResult.result as {
        matches: Array<{ text: string }>;
      };
      expect(queryPayload.matches.at(0)?.text).toContain("via-mcp");

      const screenshotResult = await postMcp("http://127.0.0.1:8787", {
        jsonrpc: "2.0",
        id: "shot",
        method: "tools/call",
        params: {
          name: "page.screenshot",
          arguments: {
            sessionId: attachPayload.sessionId,
            fullPage: false,
          },
        },
      });

      if (!isSuccess(screenshotResult)) {
        throw new Error(screenshotResult.error.message);
      }

      const screenshotPayload = screenshotResult.result as { base64: string };
      expect(screenshotPayload.base64.length).toBeGreaterThan(2_000);
    } finally {
      await context.close();
      await appServer.close();
      bridge.close();
      await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});
