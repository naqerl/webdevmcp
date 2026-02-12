import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type SupportedBrowser = "chromium" | "firefox" | "webkit";

interface BrowserRunner {
  browser: SupportedBrowser;
  command: string;
  prefixArgs: string[];
  executablePath: string;
}

interface ManagedLaunch {
  id: string;
  browser: SupportedBrowser;
  project: string;
  profileDir: string;
  runner: BrowserRunner;
  pids: number[];
}

const NATIVE_RUNNERS: Record<SupportedBrowser, string[]> = {
  chromium: [
    "google-chrome",
    "chromium",
    "chromium-browser",
    "brave-browser",
    "microsoft-edge",
    "microsoft-edge-stable",
  ],
  firefox: ["firefox"],
  webkit: [],
};

const FLATPAK_RUNNERS: Record<SupportedBrowser, string[]> = {
  chromium: [
    "com.google.Chrome",
    "org.chromium.Chromium",
    "com.brave.Browser",
    "com.microsoft.Edge",
  ],
  firefox: ["org.mozilla.firefox"],
  webkit: [],
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

function hasFlatpakApp(appId: string): boolean {
  try {
    const result = spawnSync("flatpak", ["info", appId], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function hasCommand(command: string): boolean {
  try {
    const result = spawnSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function spawnBrowser(
  runner: BrowserRunner,
  browserArgs: string[],
  detached = false,
): number | undefined {
  const child = spawn(runner.command, [...runner.prefixArgs, ...browserArgs], {
    detached,
    stdio: "ignore",
  });

  child.unref();
  return child.pid;
}

export class BrowserManager {
  readonly #launches = new Map<string, ManagedLaunch>();
  readonly #baseDir: string;
  readonly #extensionBaseDir: string;

  constructor() {
    const userHome = homedir();
    this.#baseDir = resolve(userHome, ".local", "share", "webviewmcp", "profiles");
    this.#extensionBaseDir = resolve(userHome, ".local", "share", "webviewmcp", "extensions");
  }

  async #resolveRunner(browser: SupportedBrowser): Promise<BrowserRunner | null> {
    for (const cmd of NATIVE_RUNNERS[browser]) {
      if (hasCommand(cmd)) {
        return {
          browser,
          command: cmd,
          prefixArgs: [],
          executablePath: cmd,
        };
      }
    }

    if (hasCommand("flatpak")) {
      for (const appId of FLATPAK_RUNNERS[browser]) {
        if (hasFlatpakApp(appId)) {
          return {
            browser,
            command: "flatpak",
            prefixArgs: ["run", appId],
            executablePath: `flatpak:${appId}`,
          };
        }
      }
    }

    return null;
  }

  async list(): Promise<{
    browsers: Array<{ browser: SupportedBrowser; installed: boolean; executablePath: string }>;
  }> {
    const browsers: SupportedBrowser[] = ["chromium", "firefox", "webkit"];
    const result: Array<{ browser: SupportedBrowser; installed: boolean; executablePath: string }> =
      [];

    for (const browser of browsers) {
      const runner = await this.#resolveRunner(browser);
      result.push({
        browser,
        installed: runner !== null,
        executablePath: runner?.executablePath ?? "",
      });
    }

    return { browsers: result };
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
    if (browserName !== "chromium" && browserName !== "firefox" && browserName !== "webkit") {
      throw new Error(`Unsupported browser: ${String(args.browser)}`);
    }

    const runner = await this.#resolveRunner(browserName);
    if (!runner) {
      throw new Error(`Browser not available: ${browserName}`);
    }

    const project = normalizeProjectName(
      typeof args.project === "string" ? args.project : undefined,
    );
    const headless = typeof args.headless === "boolean" ? args.headless : false;

    const profileDir = resolve(this.#baseDir, project, browserName);
    await mkdir(profileDir, { recursive: true });

    if (browserName === "firefox") {
      const extensionXpi = resolve(this.#extensionBaseDir, "firefox", "webviewmcp@local.xpi");
      const targetXpi = resolve(profileDir, "extensions", "webviewmcp@local.xpi");
      await mkdir(resolve(profileDir, "extensions"), { recursive: true });
      try {
        await copyFile(extensionXpi, targetXpi);
      } catch {
        // best effort: keep working even if extension payload is missing
      }
    }

    const launchId = `b_${randomUUID()}`;
    const pids: number[] = [];
    const browserArgs: string[] = [];

    if (browserName === "chromium") {
      const extensionDir = resolve(this.#extensionBaseDir, "chromium");
      browserArgs.push(`--user-data-dir=${profileDir}`);
      if (headless) {
        browserArgs.push("--headless=new");
      }
      browserArgs.push(`--disable-extensions-except=${extensionDir}`);
      browserArgs.push(`--load-extension=${extensionDir}`);
    }

    if (browserName === "firefox") {
      browserArgs.push("--profile", profileDir);
      if (headless) {
        browserArgs.push("--headless");
      }
    }

    const pid = spawnBrowser(runner, browserArgs, true);
    if (typeof pid === "number") {
      pids.push(pid);
    }

    this.#launches.set(launchId, {
      id: launchId,
      browser: browserName,
      project,
      profileDir,
      runner,
      pids,
    });

    return {
      launchId,
      browser: browserName,
      project,
      profileDir,
      installedNow: false,
    };
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

    const launch = this.#launches.get(launchId);
    if (!launch) {
      throw new Error("launchId not found");
    }

    const links = linksRaw.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (links.length === 0) {
      return { ok: true, opened: 0 };
    }

    const browserArgs: string[] = [];
    if (launch.browser === "chromium") {
      const extensionDir = resolve(this.#extensionBaseDir, "chromium");
      browserArgs.push(`--user-data-dir=${launch.profileDir}`);
      browserArgs.push(`--disable-extensions-except=${extensionDir}`);
      browserArgs.push(`--load-extension=${extensionDir}`);
      browserArgs.push(...links);
    } else if (launch.browser === "firefox") {
      browserArgs.push("--profile", launch.profileDir, ...links);
    } else {
      browserArgs.push(...links);
    }

    const pid = spawnBrowser(launch.runner, browserArgs);
    if (typeof pid === "number") {
      launch.pids.push(pid);
    }

    return { ok: true, opened: links.length };
  }

  async close(args: Record<string, unknown>): Promise<{ ok: boolean }> {
    const launchId = typeof args.launchId === "string" ? args.launchId : "";
    if (!launchId) {
      throw new Error("launchId is required");
    }

    const launch = this.#launches.get(launchId);
    if (!launch) {
      return { ok: false };
    }

    for (const pid of launch.pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // process already exited
      }
    }

    this.#launches.delete(launchId);
    return { ok: true };
  }

  async shutdown(): Promise<void> {
    const launchIds = Array.from(this.#launches.keys());
    for (const launchId of launchIds) {
      await this.close({ launchId });
    }
  }

  async cleanupProject(project: string): Promise<{ ok: boolean; removedPath: string }> {
    const normalizedProject = normalizeProjectName(project);
    const projectDir = resolve(this.#baseDir, normalizedProject);
    await rm(projectDir, { recursive: true, force: true });
    return { ok: true, removedPath: projectDir };
  }
}
