import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const failures = [];

async function isNonEmpty(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

for (const path of [
  "dist/index.html",
  "dist/favicon.svg",
  "dist/site.webmanifest",
  "dist/brand/comarch-markquire.svg",
  "dist/icons/icon-512.png",
]) {
  if (!(await isNonEmpty(join(root, path)))) {
    failures.push(`Missing or empty artifact: ${path}`);
  }
}

let files = [];
try {
  files = await walk(dist);
} catch {
  failures.push("Production dist directory is missing");
}

if (!files.some((path) => path.endsWith(".js"))) {
  failures.push("Production artifact has no JavaScript bundle");
}

if (!files.some((path) => path.endsWith(".css"))) {
  failures.push("Production artifact has no CSS bundle");
}

for (const path of files) {
  const name = relative(dist, path);
  if (name.endsWith(".map") || name.startsWith(".env")) {
    failures.push(`Unexpected release file: dist/${name}`);
  }
}

if (await isNonEmpty(join(dist, "index.html"))) {
  const index = await readFile(join(dist, "index.html"), "utf8");
  if (index.includes("/src/main.tsx")) {
    failures.push("dist/index.html still references development source");
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${files.length} production artifact files`);
}
