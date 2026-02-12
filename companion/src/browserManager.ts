import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { type BrowserContext, type BrowserType, chromium, firefox, webkit } from "playwright";

export type SupportedBrowser = "chromium" | "firefox" | "webkit";
type PersistentLaunchOptions = Parameters<BrowserType["launchPersistentContext"]>[1];

interface ManagedContext {
  id: string;
  browser: SupportedBrowser;
  project: string;
  profileDir: string;
  context: BrowserContext;
}

const BROWSER_TYPES: Record<SupportedBrowser, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

function normalizeProjectName(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) {
    return "default";
  }

  return (
    raw
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "") || "default"
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Command failed: ${cmd} ${args.join(" ")}`));
    });
  });
}

export class BrowserManager {
  readonly #contexts = new Map<string, ManagedContext>();
  readonly #baseDir: string;
  readonly #extensionBaseDir: string;

  constructor() {
    const userHome = homedir();
    this.#baseDir = resolve(userHome, ".local", "share", "webviewmcp", "profiles");
    this.#extensionBaseDir = resolve(userHome, ".local", "share", "webviewmcp", "extensions");
  }

  async list(): Promise<{
    browsers: Array<{ browser: SupportedBrowser; installed: boolean; executablePath: string }>;
  }> {
    const entries: Array<{
      browser: SupportedBrowser;
      installed: boolean;
      executablePath: string;
    }> = [];

    for (const browser of ["chromium", "firefox", "webkit"] as const) {
      const type = BROWSER_TYPES[browser];
      const executablePath = type.executablePath();
      const installed = await isExecutable(executablePath);
      entries.push({ browser, installed, executablePath });
    }

    return { browsers: entries };
  }

  async launch(args: Record<string, unknown>): Promise<{
    launchId: string;
    browser: SupportedBrowser;
    project: string;
    profileDir: string;
    installedNow: boolean;
  }> {
    const browserName = (
      typeof args.browser === "string" ? args.browser : "chromium"
    ) as SupportedBrowser;
    if (!(browserName in BROWSER_TYPES)) {
      throw new Error(`Unsupported browser: ${String(args.browser)}`);
    }

    const project = normalizeProjectName(
      typeof args.project === "string" ? args.project : undefined,
    );
    const headless = typeof args.headless === "boolean" ? args.headless : false;

    const type = BROWSER_TYPES[browserName];
    const executablePath = type.executablePath();
    let installedNow = false;

    if (!(await isExecutable(executablePath))) {
      await runCommand("npx", ["playwright", "install", browserName]);
      installedNow = true;
    }

    const profileDir = resolve(this.#baseDir, project, browserName);
    await mkdir(profileDir, { recursive: true });

    const options: PersistentLaunchOptions = {
      headless,
    };

    if (browserName === "chromium") {
      const extensionDir = resolve(this.#extensionBaseDir, "chromium");
      if (await pathExists(extensionDir)) {
        options.args = [
          `--disable-extensions-except=${extensionDir}`,
          `--load-extension=${extensionDir}`,
        ];
      }
    }

    if (browserName === "firefox") {
      const extensionXpi = resolve(this.#extensionBaseDir, "firefox", "webviewmcp@local.xpi");
      const targetXpi = resolve(profileDir, "extensions", "webviewmcp@local.xpi");
      await mkdir(resolve(profileDir, "extensions"), { recursive: true });
      if (await pathExists(extensionXpi)) {
        await copyFile(extensionXpi, targetXpi);
      }

      options.firefoxUserPrefs = {
        "xpinstall.signatures.required": false,
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
      };
    }

    const context = await type.launchPersistentContext(profileDir, options);
    const launchId = `b_${randomUUID()}`;

    this.#contexts.set(launchId, {
      id: launchId,
      browser: browserName,
      project,
      profileDir,
      context,
    });

    return {
      launchId,
      browser: browserName,
      project,
      profileDir,
      installedNow,
    };
  }

  async close(args: Record<string, unknown>): Promise<{ ok: boolean }> {
    const launchId = typeof args.launchId === "string" ? args.launchId : "";
    if (!launchId) {
      throw new Error("launchId is required");
    }

    const managed = this.#contexts.get(launchId);
    if (!managed) {
      return { ok: false };
    }

    await managed.context.close();
    this.#contexts.delete(launchId);
    return { ok: true };
  }

  async openLinks(args: Record<string, unknown>): Promise<{ ok: boolean; opened: number }> {
    const launchId = typeof args.launchId === "string" ? args.launchId : "";
    const linksRaw = Array.isArray(args.links) ? args.links : null;

    if (!launchId) {
      throw new Error("launchId is required");
    }

    if (!linksRaw) {
      throw new Error("links must be an array");
    }

    const managed = this.#contexts.get(launchId);
    if (!managed) {
      throw new Error("launchId not found");
    }

    const links = linksRaw.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    if (links.length === 0) {
      return { ok: true, opened: 0 };
    }

    const firstLink = links[0];
    if (!firstLink) {
      return { ok: true, opened: 0 };
    }

    const pages = managed.context.pages();
    const firstPage = pages.length > 0 ? pages[0] : await managed.context.newPage();
    if (!firstPage) {
      throw new Error("Unable to get a page for browser context");
    }

    await firstPage.goto(firstLink, { waitUntil: "domcontentloaded" });

    for (const link of links.slice(1)) {
      const page = await managed.context.newPage();
      await page.goto(link, { waitUntil: "domcontentloaded" });
    }

    return { ok: true, opened: links.length };
  }

  async shutdown(): Promise<void> {
    const closing = Array.from(this.#contexts.values()).map(async (managed) => {
      try {
        await managed.context.close();
      } catch {
        // best effort shutdown
      }
    });

    await Promise.all(closing);
    this.#contexts.clear();
  }

  async cleanupProject(project: string): Promise<{ ok: boolean; removedPath: string }> {
    const normalizedProject = normalizeProjectName(project);
    const projectDir = resolve(this.#baseDir, normalizedProject);
    await rm(projectDir, { recursive: true, force: true });
    return { ok: true, removedPath: projectDir };
  }
}
