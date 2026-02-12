import { cwd, exit, stderr, stdout } from "node:process";

import type { ToolName } from "@webviewmcp/protocol";

import { BrowserManager } from "./browserManager.js";
import { ExtensionBridge } from "./extensionBridge.js";
import { loadProjectConfig } from "./projectConfig.js";
import { createMcpHttpServer } from "./server.js";

const httpPort = Number(process.env.PORT ?? "8787");
const httpHost = process.env.HOST ?? "127.0.0.1";
const bridgePort = Number(process.env.BRIDGE_PORT ?? "8788");

const browserManager = new BrowserManager();
const bridge = new ExtensionBridge(bridgePort);

const dispatcher = {
  dispatch: async (name: ToolName, args: Record<string, unknown>): Promise<unknown> => {
    if (name === "browser.list") {
      return await browserManager.list();
    }

    if (name === "browser.launch") {
      return await browserManager.launch(args);
    }

    if (name === "browser.close") {
      return await browserManager.close(args);
    }

    return await bridge.dispatch(name, args);
  },
};

const server = createMcpHttpServer({ dispatcher });

async function bootProjectSession(
  config: Awaited<ReturnType<typeof loadProjectConfig>>,
): Promise<void> {
  const launch = await browserManager.launch({
    browser: config.browser,
    project: config.project,
    headless: config.headless,
  });

  await browserManager.openLinks({
    launchId: launch.launchId,
    links: config.links,
  });

  stdout.write(
    `webviewmcp ready on http://${httpHost}:${String(httpPort)}/mcp with ${config.browser} (${config.project})\n`,
  );
}

async function shutdown(): Promise<void> {
  await browserManager.shutdown();
  bridge.close();
  server.close();
}

async function main(): Promise<void> {
  server.once("error", (error) => {
    stderr.write(`Failed to start MCP HTTP server: ${error.message}\n`);
    void shutdown().finally(() => {
      exit(1);
    });
  });

  // Load or create project config first so first-run prompts appear immediately.
  const config = await loadProjectConfig(cwd());

  await new Promise<void>((resolve) => {
    server.listen(httpPort, httpHost, () => {
      resolve();
    });
  });

  await bootProjectSession(config);
}

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  stderr.write(`Startup failed: ${message}\n`);
  await shutdown();
  exit(1);
});

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
