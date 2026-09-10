import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const generatedPaths = ["AGENTS.md", "CLAUDE.md", ".claude", ".factory"];

async function walk(path) {
  const files = [];
  try {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(child)));
      } else {
        files.push(child);
      }
    }
  } catch {
    files.push(path);
  }
  return files;
}

async function snapshot() {
  const files = (
    await Promise.all(generatedPaths.map((path) => walk(resolve(root, path))))
  ).flat();
  const entries = await Promise.all(
    files.map(async (path) => {
      try {
        return [relative(root, path), await readFile(path, "utf8")];
      } catch {
        return [relative(root, path), null];
      }
    }),
  );
  return new Map(entries);
}

function run(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const before = await snapshot();
run("promptscript:validate");
run("promptscript:compile");
const after = await snapshot();
const paths = new Set([...before.keys(), ...after.keys()]);
const changed = [...paths].filter(
  (path) => before.get(path) !== after.get(path),
);

if (changed.length > 0) {
  console.error(
    [
      "PromptScript generated output changed:",
      ...changed.map((path) => `- ${path}`),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Verified ${after.size} generated PromptScript files`);
}
