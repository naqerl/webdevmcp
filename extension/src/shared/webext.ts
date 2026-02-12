interface QueryInfo {
  active?: boolean;
  currentWindow?: boolean;
}

interface Tab {
  id?: number;
  title?: string;
  url?: string;
  active?: boolean;
  windowId?: number;
}

interface RuntimeMessageSender {
  frameId?: number;
}

interface TabsApi {
  query: (queryInfo: QueryInfo) => Promise<Tab[]>;
  sendMessage: (
    tabId: number,
    message: unknown,
    options?: { frameId?: number },
  ) => Promise<unknown>;
  captureVisibleTab: (windowId?: number, options?: { format?: "png" | "jpeg" }) => Promise<string>;
}

interface RuntimeApi {
  onMessage: {
    addListener: (
      listener: (message: unknown, sender: RuntimeMessageSender) => Promise<unknown> | unknown,
    ) => void;
  };
}

interface WebExtensionApi {
  tabs: TabsApi;
  runtime: RuntimeApi;
}

export type { RuntimeMessageSender, Tab, WebExtensionApi };

function getGlobal(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

export function getWebExtensionApi(): WebExtensionApi {
  const root = getGlobal();
  const browserApi = root.browser;
  if (browserApi && typeof browserApi === "object") {
    return browserApi as WebExtensionApi;
  }

  const chromeApi = root.chrome;
  if (chromeApi && typeof chromeApi === "object") {
    return chromeApi as WebExtensionApi;
  }

  throw new Error("WebExtension API is unavailable");
}
