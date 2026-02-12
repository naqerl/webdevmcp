import { describe, expect, it } from "vitest";

import { TOOL_NAMES, createJsonRpcError, isToolName } from "@webviewmcp/protocol";

describe("protocol", () => {
  it("exposes a stable tool list", () => {
    expect(TOOL_NAMES.length).toBeGreaterThan(5);
    expect(TOOL_NAMES).toContain("tabs.list");
    expect(TOOL_NAMES).toContain("page.screenshot");
  });

  it("validates tool names", () => {
    expect(isToolName("tabs.list")).toBe(true);
    expect(isToolName("unknown.tool")).toBe(false);
  });

  it("creates JSON-RPC errors", () => {
    const error = createJsonRpcError("1", -32602, "Invalid params");
    expect(error.jsonrpc).toBe("2.0");
    expect(error.error.code).toBe(-32602);
  });
});
