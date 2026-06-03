// Erkennt Sprache, Framework, ORM, Quell-Roots und Pfad-Aliase eines Projekts.
// Das ist die Grundlage dafür, dass Cartomap sich an JEDES Projekt anpasst —
// auch an einen leeren Ordner (Greenfield), ohne zu crashen.

import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

// Toleranter JSON-Leser (verträgt Kommentare + trailing commas, z.B. in tsconfig.json).
export function readJsonLoose(path) {
  try {
    let s = readFileSync(path, "utf8");
    s = s.replace(/\/\*[\s\S]*?\*\//g, "");        // Blockkommentare
    s = s.replace(/(^|[^:"'])\/\/.*$/gm, "$1");    // Zeilenkommentare (URLs grob schonen)
    s = s.replace(/,(\s*[}\]])/g, "$1");           // trailing commas
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Pfad-Aliase aus tsconfig.json ODER jsconfig.json paths ableiten:  "@/*": ["./src/*"]  ->  { "@/": "src/" }
// (jsconfig.json wird von JS-Next-Projekten genutzt — ohne dies wuerden deren @/-Importe als extern gelten.)
export function readTsconfigAliases(repoRoot) {
  const tsconfig = readJsonLoose(join(repoRoot, "tsconfig.json")) || readJsonLoose(join(repoRoot, "jsconfig.json"));
  const aliases = {};
  const paths = tsconfig?.compilerOptions?.paths;
  let baseUrl = tsconfig?.compilerOptions?.baseUrl ?? ".";
  if (baseUrl === ".") baseUrl = "";
  if (paths) {
    for (const [pattern, targets] of Object.entries(paths)) {
      const from = pattern.replace(/\*$/, "");
      const target = Array.isArray(targets) ? targets[0] : targets;
      const to = String(target).replace(/^\.\//, "").replace(/\*$/, "");
      aliases[from] = (baseUrl ? baseUrl.replace(/\/$/, "") + "/" : "") + to;
    }
  }
  return aliases;
}

export function detect(repoRoot) {
  const has = (f) => existsSync(join(repoRoot, f));
  const pkg = readJsonLoose(join(repoRoot, "package.json"));

  // Sprache + Manifest
  let language = "unknown";
  let manifest = null;
  if (pkg) {
    language = "javascript";
    manifest = "package.json";
  } else if (has("pyproject.toml") || has("requirements.txt") || has("setup.py")) {
    language = "python";
    manifest = has("pyproject.toml") ? "pyproject.toml" : has("requirements.txt") ? "requirements.txt" : "setup.py";
  } else if (has("go.mod")) {
    language = "go";
    manifest = "go.mod";
  } else if (has("Cargo.toml")) {
    language = "rust";
    manifest = "Cargo.toml";
  } else if (has("composer.json")) {
    language = "php";
    manifest = "composer.json";
  } else if (has("Gemfile")) {
    language = "ruby";
    manifest = "Gemfile";
  } else if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts")) {
    language = "jvm";
    manifest = has("pom.xml") ? "pom.xml" : "build.gradle";
  }

  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};

  // TypeScript-Verfeinerung
  if (language === "javascript" && (has("tsconfig.json") || deps.typescript)) language = "typescript";

  // Framework
  let framework = "none";
  if (deps.next) framework = "nextjs";
  else if (deps.nuxt) framework = "nuxt";
  else if (deps["@remix-run/react"]) framework = "remix";
  else if (deps.astro) framework = "astro";
  else if (deps["@nestjs/core"]) framework = "nestjs";
  else if (deps.express || deps.fastify || deps.koa || deps.hono) framework = "node-server";
  else if (deps.svelte) framework = "svelte";
  else if (deps.vue) framework = "vue";
  else if (deps.react) framework = "react";

  // ORM
  let orm = "none";
  if (deps["@prisma/client"] || deps.prisma || has("prisma/schema.prisma")) orm = "prisma";
  else if (deps["drizzle-orm"]) orm = "drizzle";

  // Quell-Roots erraten (existierende übliche Verzeichnisse)
  const rootCandidates = ["src", "app", "lib", "source", "pkg", "internal", "cmd", "components", "bin"];
  let roots = rootCandidates.filter((d) => has(d));
  if (roots.length === 0) roots = ["."]; // flach oder leer -> ganzes Verzeichnis

  const aliases = readTsconfigAliases(repoRoot);
  const adapter = language === "typescript" || language === "javascript" ? "typescript" : "generic";
  const isEmpty = !pkg && !manifest && roots.length === 1 && roots[0] === ".";

  return { name: basename(repoRoot), language, framework, orm, manifest, roots, aliases, adapter, isEmpty };
}
