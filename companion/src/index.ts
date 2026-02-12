import type { ToolName } from "@webviewmcp/protocol";

import { BrowserManager } from "./browserManager.js";
import { ExtensionBridge } from "./extensionBridge.js";
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

server.listen(httpPort, httpHost);

async function shutdown(): Promise<void> {
  await browserManager.shutdown();
  bridge.close();
  server.close();
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
