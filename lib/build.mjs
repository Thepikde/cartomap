// Orchestriert einen Build: Config laden → Adapter waehlen → Dateien scannen → parsen →
// Graph bauen → graph.json + ARCHITECTURE.md schreiben.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { scan } from "./scan.mjs";
import { gitSync } from "./gitsync.mjs";
import { loadConfig } from "./config.mjs";
import { buildGraph } from "./graph.mjs";
import { detectEntryPoints } from "./entrypoints.mjs";
import { renderArchitecture } from "./render.mjs";
import * as tsAdapter from "./adapter-typescript.mjs";
import * as genericAdapter from "./adapter-generic.mjs";

const ADAPTERS = { typescript: tsAdapter, generic: genericAdapter };

const SCHEMA_VERSION = 2;
const TOOL_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version;
  } catch {
    return "0.0.0";
  }
})();

export async function build(repoRoot, { silent = false, quiet = false, verbose = false } = {}) {
  const config = loadConfig(repoRoot);
  const adapter = ADAPTERS[config.adapter] ?? genericAdapter;
  const ctx = await adapter.prepare({ repoRoot, config });

  const exts = adapter.extensions(config);
  const absFiles = scan(repoRoot, { roots: config.roots, exts, ignore: config.ignore });

  const files = {};
  const failed = [];
  for (const abs of absFiles) {
    const rel = relative(repoRoot, abs);
    try {
      files[rel] = adapter.parseFile({ absPath: abs, relPath: rel, repoRoot, config, ctx });
    } catch {
      failed.push(rel);
      files[rel] = { kind: "source", imports: [], externals: [], exports: [], isClient: false, models: [] };
    }
  }

  const graph = buildGraph(files, { config, ctx });
  graph.entryPoints = detectEntryPoints({ repoRoot, config, files });
  graph.schemaVersion = SCHEMA_VERSION;
  graph.tool = "cartomap";
  graph.version = TOOL_VERSION;
  const sync = gitSync(repoRoot);

  const outDir = join(repoRoot, config.out || ".cartomap");
  mkdirSync(outDir, { recursive: true });

  // graph.json bewusst OHNE sync (das aendert sich staendig → git-Rauschen).
  writeFileSync(join(outDir, "graph.json"), JSON.stringify(graph, null, 2) + "\n");
  writeFileSync(join(outDir, "ARCHITECTURE.md"), renderArchitecture({ ...graph, sync }, config));

  if (!silent) {
    if (quiet) console.log(`🗺️  Cartomap: map updated (${graph.stats.files} files)`);
    else printSummary({ ...graph, sync }, config, outDir, repoRoot);
    if (verbose && failed.length) {
      console.log(`\n⚠️  ${failed.length} file(s) could not be parsed:`);
      for (const f of failed.slice(0, 50)) console.log(`   - ${f}`);
    }
    warnWatchDrift(repoRoot, config);
  }
  return { ...graph, sync, failed };
}

function printSummary(graph, config, outDir, repoRoot) {
  const s = graph.stats;
  console.log(`\n🗺️  Cartomap — ${graph.name}`);
  let line = `   Files: ${s.files}`;
  if (s.pages) line += ` · Pages: ${s.pages}`;
  if (s.apiRoutes) line += ` · API: ${s.apiRoutes}`;
  if (s.components) line += ` · Components: ${s.components}`;
  if (s.models) line += ` · Models: ${s.models}`;
  console.log(line);
  if (graph.usedTs === false && config.adapter === "typescript") {
    console.log(`   ℹ️  light analysis — 'typescript' not found in project (for full depth: npm i -D typescript)`);
  }
  if (graph.sync) {
    const flag = graph.sync.behind > 0 ? `⚠️  ${graph.sync.behind} behind origin/${graph.sync.branch}` : `✓ up to date (${graph.sync.branch})`;
    console.log(`   Sync: ${flag}`);
  }
  console.log(`   → ${relative(repoRoot, outDir) || ".cartomap"}/ (ARCHITECTURE.md, graph.json)`);
}

// Hinweis, wenn „kritischer" Code (config.watch) gestaged ist, aber kein memory/-Eintrag.
function warnWatchDrift(repoRoot, config) {
  if (!config.watch || !config.watch.length) return;
  let staged;
  try {
    staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter(Boolean);
  } catch {
    return;
  }
  if (!staged.length) return;
  const touchesWatch = staged.some((f) => config.watch.some((w) => f.includes(w)));
  const touchesMemory = staged.some((f) => f.includes(`${config.out}/memory`) || f.includes("/memory/"));
  if (touchesWatch && !touchesMemory) {
    console.log(`\n🔖 Cartomap: you're changing code marked as "critical" (config.watch),`);
    console.log(`   but no memory/ note is staged. Consider recording a decision in .cartomap/memory/.`);
  }
}
