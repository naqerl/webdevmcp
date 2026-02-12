import type { ToolName } from "@webviewmcp/protocol";

import {
  isContentToolRequest,
  type ContentToolRequest,
  type ContentToolResponse,
} from "../shared/messages.js";
import { getWebExtensionApi } from "../shared/webext.js";

interface SnapshotNode {
  nodeId: string;
  tag: string;
  text?: string;
  visible: boolean;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children: SnapshotNode[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function selectorFor(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    const tagName = current.tagName.toLowerCase();
    const id = current.id;
    if (id) {
      parts.unshift(`${tagName}#${CSS.escape(id)}`);
      break;
    }

    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tagName);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName.toLowerCase() === tagName,
    );
    const siblingIndex = sameTagSiblings.indexOf(current) + 1;
    parts.unshift(`${tagName}:nth-of-type(${siblingIndex})`);
    current = parent;
  }

  return parts.join(" > ");
}

function isVisible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  return htmlElement.offsetWidth > 0 || htmlElement.offsetHeight > 0;
}

function toSnapshotNode(
  element: Element,
  options: { includeText: boolean; includeBounds: boolean; maxNodes: number },
  state: { count: number },
): SnapshotNode {
  const nodeId = selectorFor(element);
  const node: SnapshotNode = {
    nodeId,
    tag: element.tagName.toLowerCase(),
    visible: isVisible(element),
    children: [],
  };

  if (options.includeText) {
    const text = element.textContent?.trim();
    if (text) {
      node.text = text.slice(0, 500);
    }
  }

  if (options.includeBounds) {
    const rect = element.getBoundingClientRect();
    node.bounds = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  const children = Array.from(element.children);
  for (const child of children) {
    if (state.count >= options.maxNodes) {
      break;
    }

    state.count += 1;
    node.children.push(toSnapshotNode(child, options, state));
  }

  return node;
}

function resolveElement(args: Record<string, unknown>): Element | null {
  const selector = asString(args.selector);
  const nodeId = asString(args.nodeId);
  const query = selector ?? nodeId;
  if (!query) {
    return null;
  }

  return document.querySelector(query);
}

function queryElements(args: Record<string, unknown>): Element[] {
  const selector = asString(args.selector);
  if (!selector) {
    throw new Error("selector is required");
  }

  const all = asBoolean(args.all, false);
  return all ? Array.from(document.querySelectorAll(selector)) : Array.from(document.querySelectorAll(selector)).slice(0, 1);
}

async function waitFor(args: Record<string, unknown>): Promise<{ ok: true; elapsedMs: number }> {
  const selector = asString(args.selector);
  const text = asString(args.text);
  const timeoutMs = asPositiveInt(args.timeoutMs, 10_000);
  const pollMs = asPositiveInt(args.pollMs, 200);

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (selector && document.querySelector(selector)) {
      return { ok: true, elapsedMs: Date.now() - start };
    }

    if (text && document.body.textContent?.includes(text)) {
      return { ok: true, elapsedMs: Date.now() - start };
    }

    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error("wait_for timeout");
}

async function handleTool(name: ToolName, args: Record<string, unknown>): Promise<unknown> {
  if (name === "page.snapshot_dom") {
    const includeText = asBoolean(args.includeText, true);
    const includeBounds = asBoolean(args.includeBounds, true);
    const maxNodes = asPositiveInt(args.maxNodes, 2_000);

    const rootElement = document.documentElement;
    const state = { count: 1 };

    return {
      root: toSnapshotNode(rootElement, { includeText, includeBounds, maxNodes }, state),
      nodeCount: state.count,
      title: document.title,
      url: window.location.href,
    };
  }

  if (name === "page.query") {
    const elements = queryElements(args);

    return {
      matches: elements.map((element) => ({
        nodeId: selectorFor(element),
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim() ?? "",
        visible: isVisible(element),
      })),
    };
  }

  if (name === "element.click") {
    const element = resolveElement(args);
    if (!element) {
      throw new Error("Element not found");
    }

    (element as HTMLElement).click();
    return { ok: true };
  }

  if (name === "element.type") {
    const element = resolveElement(args);
    if (!element) {
      throw new Error("Element not found");
    }

    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      throw new Error("Target is not a text input");
    }

    const clearFirst = asBoolean(args.clearFirst, false);
    const text = asString(args.text) ?? "";

    if (clearFirst) {
      element.value = "";
    }

    element.focus();
    element.value = `${element.value}${text}`;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    return { ok: true };
  }

  if (name === "element.keypress") {
    const element = resolveElement(args);
    const key = asString(args.key) ?? "Enter";

    const target = (element as HTMLElement | null) ?? document.body;
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));

    return { ok: true };
  }

  if (name === "page.scroll") {
    const selector = asString(args.selector);
    if (selector) {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error("Element not found");
      }

      element.scrollIntoView({ behavior: "auto", block: "start" });
    } else {
      const x = asNumber(args.x) ?? window.scrollX;
      const y = asNumber(args.y) ?? window.scrollY;
      window.scrollTo(x, y);
    }

    return {
      ok: true,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  if (name === "page.get_html") {
    const selector = asString(args.selector);
    const element = selector ? document.querySelector(selector) : document.documentElement;
    if (!element) {
      throw new Error("Element not found");
    }

    return { html: element.outerHTML };
  }

  if (name === "page.wait_for") {
    return await waitFor(args);
  }

  throw new Error(`Unsupported content tool: ${name}`);
}

async function handleRequest(message: ContentToolRequest): Promise<ContentToolResponse> {
  try {
    const result = await handleTool(message.name, message.args);
    return { ok: true, result };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: messageText };
  }
}

const api = getWebExtensionApi();
api.runtime.onMessage.addListener(async (message) => {
  if (!isContentToolRequest(message)) {
    return { ok: false, error: "Unsupported message" };
  }

  return await handleRequest(message);
});
