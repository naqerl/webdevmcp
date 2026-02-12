import { constants as fsConstants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import type { SupportedBrowser } from "./browserManager.js";

const CONFIG_FILE = "webdev.toml";

export interface ProjectConfig {
  browser: SupportedBrowser;
  links: string[];
  project: string;
  headless: boolean;
}

function parseBoolean(value: string): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseQuotedString(value: string): string | null {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return null;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    return null;
  }
}

function parseStringArray(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  const matches = Array.from(trimmed.matchAll(/"((?:\\.|[^"])*)"/g));
  const values = matches.map((match) => {
    return JSON.parse(`"${match[1]}"`) as string;
  });

  return values;
}

function normalizeProjectName(raw: string): string {
  const normalized = raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  return normalized.length > 0 ? normalized : "default";
}

function parseConfig(content: string, cwd: string): ProjectConfig {
  let browser: SupportedBrowser = "chromium";
  let project = normalizeProjectName(basename(cwd));
  let headless = false;
  let links: string[] = [];

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (key === "browser") {
      const parsed = parseQuotedString(value);
      if (parsed === "chromium" || parsed === "firefox" || parsed === "webkit") {
        browser = parsed;
      }
      continue;
    }

    if (key === "project") {
      const parsed = parseQuotedString(value);
      if (parsed) {
        project = normalizeProjectName(parsed);
      }
      continue;
    }

    if (key === "headless") {
      const parsed = parseBoolean(value);
      if (parsed !== null) {
        headless = parsed;
      }
      continue;
    }

    if (key === "links" || key === "urls") {
      const parsed = parseStringArray(value);
      if (parsed) {
        links = parsed.filter((link) => link.length > 0);
      }
    }
  }

  if (links.length === 0) {
    links = ["http://localhost:3000"];
  }

  return {
    browser,
    links,
    project,
    headless,
  };
}

function toToml(config: ProjectConfig): string {
  const quotedLinks = config.links.map((link) => JSON.stringify(link)).join(", ");
  return [
    "# webviewmcp project configuration",
    `browser = ${JSON.stringify(config.browser)}`,
    `project = ${JSON.stringify(config.project)}`,
    `headless = ${config.headless ? "true" : "false"}`,
    `links = [${quotedLinks}]`,
    "",
  ].join("\n");
}

async function promptConfig(cwd: string): Promise<ProjectConfig> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  const defaultProject = normalizeProjectName(basename(cwd));

  try {
    stdout.write("\nwebdev.toml not found. Let's create one for this project.\n\n");
    stdout.write("Choose browser:\n");
    stdout.write("  1) chromium (recommended)\n");
    stdout.write("  2) firefox\n");
    stdout.write("  3) webkit\n\n");

    const browserInput = (await rl.question("Browser [1]: ")).trim();
    const browser: SupportedBrowser =
      browserInput === "2" ? "firefox" : browserInput === "3" ? "webkit" : "chromium";

    const projectInput = (await rl.question(`Project name [${defaultProject}]: `)).trim();
    const project = normalizeProjectName(projectInput.length > 0 ? projectInput : defaultProject);

    const linksInput = (
      await rl.question("Links to open (comma-separated) [http://localhost:3000]: ")
    ).trim();
    const links =
      linksInput.length === 0
        ? ["http://localhost:3000"]
        : linksInput
            .split(",")
            .map((link) => link.trim())
            .filter((link) => link.length > 0);

    const headlessInput = (await rl.question("Headless mode? [y/N]: ")).trim().toLowerCase();
    const headless = headlessInput === "y" || headlessInput === "yes";

    return {
      browser,
      links,
      project,
      headless,
    };
  } finally {
    rl.close();
  }
}

export async function loadProjectConfig(cwd: string): Promise<ProjectConfig> {
  const path = resolve(cwd, CONFIG_FILE);

  try {
    await access(path, fsConstants.R_OK);
    const raw = await readFile(path, "utf8");
    return parseConfig(raw, cwd);
  } catch {
    if (!stdin.isTTY || !stdout.isTTY) {
      throw new Error(
        `Missing ${CONFIG_FILE} in ${cwd}. Create it or run in interactive terminal.`,
      );
    }

    const config = await promptConfig(cwd);
    await writeFile(path, toToml(config), "utf8");
    stdout.write(`\nCreated ${CONFIG_FILE} at ${path}\n`);
    return config;
  }
}
