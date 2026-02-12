import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function buildManifest(target) {
  const root = resolve("extension");
  await mkdir(resolve(root, "dist"), { recursive: true });
  const base = JSON.parse(await readFile(resolve(root, "manifest.base.json"), "utf8"));
  const override = JSON.parse(await readFile(resolve(root, `manifest.${target}.json`), "utf8"));

  const { extends: _extends, ...rest } = override;
  const merged = {
    ...base,
    ...rest,
  };

  await writeFile(
    resolve(root, `manifest.${target}.built.json`),
    `${JSON.stringify(merged, null, 2)}\n`,
  );
  await writeFile(
    resolve(root, "dist", `${target}.manifest.json`),
    `${JSON.stringify(merged, null, 2)}\n`,
  );

  if (target === "chromium") {
    await writeFile(resolve(root, "manifest.json"), `${JSON.stringify(merged, null, 2)}\n`);
  }
}

await buildManifest("chromium");
await buildManifest("firefox");
