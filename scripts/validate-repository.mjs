import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const ignoredDirectories = new Set([
  ".code-review-graph",
  ".git",
  ".worktrees",
  "coverage",
  "dist",
  "node_modules",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".prs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const requiredFiles = [
  ".editorconfig",
  ".dockerignore",
  ".gitattributes",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/promptscript.yml",
  ".github/workflows/publish-release.yml",
  ".github/workflows/release-please.yml",
  ".github/workflows/security.yml",
  ".nvmrc",
  ".promptscript/project.prs",
  ".release-please-manifest.json",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "docs/COMPATIBILITY.md",
  "docs/RELEASE.md",
  "docs/REPOSITORY_SETTINGS.md",
  "docs/SECURITY_MODEL.md",
  "docs/VALIDATION.md",
  "eslint.config.js",
  "package-lock.json",
  "package.json",
  "promptscript.yaml",
  "release-please-config.json",
  "renovate.json",
  "scripts/check-promptscript.mjs",
  "scripts/verify-artifact.mjs",
];

async function exists(path) {
  try {
    await stat(join(root, path));
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

for (const file of requiredFiles) {
  if (!(await exists(file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json")));
const packageLock = JSON.parse(await readFile(join(root, "package-lock.json")));
const releaseManifest = JSON.parse(
  await readFile(join(root, ".release-please-manifest.json")),
);
const workspaceManifest = JSON.parse(
  await readFile(join(root, "google-workspace-manifest.json")),
);

if (packageJson.private !== true) {
  failures.push("Browser application package must remain private");
}

if (
  packageLock.name !== packageJson.name ||
  packageLock.version !== packageJson.version
) {
  failures.push("package-lock.json identity differs from package.json");
}

if (
  packageLock.packages?.[""]?.name !== packageJson.name ||
  packageLock.packages?.[""]?.version !== packageJson.version
) {
  failures.push("package-lock.json root package differs from package.json");
}

if (releaseManifest["."] !== packageJson.version) {
  failures.push("Release Please manifest version differs from package.json");
}

if (workspaceManifest.version !== packageJson.version) {
  failures.push("Google Workspace manifest version differs from package.json");
}

for (const script of [
  "build",
  "format:check",
  "lint",
  "test",
  "test:coverage",
  "typecheck",
  "validate",
  "verify:artifact",
  "verify:repository",
]) {
  if (!packageJson.scripts?.[script]) {
    failures.push(`Missing package script: ${script}`);
  }
}

if (!(await exists("coverage/lcov.info"))) {
  failures.push("Coverage report is missing");
}

const files = await walk(root);
for (const file of files) {
  const name = relative(root, file).split(sep).join("/");
  const extension = name.slice(name.lastIndexOf("."));
  if (
    !textExtensions.has(extension) &&
    ![".editorconfig", ".env.example", ".gitignore", ".nvmrc"].includes(name)
  ) {
    continue;
  }

  const content = await readFile(file, "utf8");

  if (name !== "scripts/validate-repository.mjs") {
    if (/[—–]/u.test(content)) {
      failures.push(`Forbidden Unicode dash: ${name}`);
    }

    if (
      /REPLACE_ME|OWNER\/REPO|CHANGE_THIS|YOUR_[A-Z0-9_]+|example\.com|your-domain\.com/u.test(
        content,
      )
    ) {
      failures.push(`Unresolved placeholder: ${name}`);
    }

    if (/\b(?:ghp|github_pat|glpat|xoxb|AKIA)[A-Za-z0-9_:-]*/u.test(content)) {
      failures.push(`Possible credential pattern: ${name}`);
    }
  }

  if (name.startsWith(".github/workflows/")) {
    for (const line of content.split("\n")) {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith("uses:") || trimmed.includes("./")) {
        continue;
      }
      if (!/@[0-9a-f]{40}\s+#\s+v/u.test(trimmed)) {
        failures.push(`Unpinned GitHub Action in ${name}: ${trimmed}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated repository contract across ${files.length} files`);
}
