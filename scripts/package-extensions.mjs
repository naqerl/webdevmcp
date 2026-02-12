import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const extensionRoot = resolve(root, "extension");
const distDir = resolve(extensionRoot, "dist");
const outRoot = resolve(root, "artifacts", "extensions");
const packageRoot = resolve(root, "artifacts", "package");

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const version = String(pkg.version);

await rm(outRoot, { recursive: true, force: true });
await rm(packageRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });

for (const target of ["chromium", "firefox"]) {
  const targetDir = resolve(packageRoot, target);
  await mkdir(targetDir, { recursive: true });

  await cp(distDir, resolve(targetDir, "dist"), { recursive: true });

  const manifestSource = resolve(extensionRoot, `manifest.${target}.built.json`);
  const manifestRaw = await readFile(manifestSource, "utf8");
  await writeFile(resolve(targetDir, "manifest.json"), manifestRaw);

  await writeFile(resolve(outRoot, `${target}.zipname`), `webviewmcp-${target}-v${version}.zip\n`);
}
