import { ExtensionBridge } from "./extensionBridge.js";
import { createMcpHttpServer } from "./server.js";

const httpPort = Number(process.env.PORT ?? "8787");
const httpHost = process.env.HOST ?? "127.0.0.1";
const bridgePort = Number(process.env.BRIDGE_PORT ?? "8788");

const bridge = new ExtensionBridge(bridgePort);
const server = createMcpHttpServer({ dispatcher: bridge });

server.listen(httpPort, httpHost);

function shutdown(): void {
  bridge.close();
  server.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
