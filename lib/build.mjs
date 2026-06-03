// Orchestriert einen Build: Config laden → Adapter wählen → Dateien scannen → parsen →
// Graph bauen → graph.json + ARCHITECTURE.md schreiben.

import { writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

import { walk } from "./walk.mjs";
import { gitSync } from "./gitsync.mjs";
import { loadConfig } from "./config.mjs";
import { buildGraph } from "./graph.mjs";
import { renderArchitecture } from "./render.mjs";
import * as tsAdapter from "./adapter-typescript.mjs";
import * as genericAdapter from "./adapter-generic.mjs";

const ADAPTERS = { typescript: tsAdapter, generic: genericAdapter };

export async function build(repoRoot, { silent = false, quiet = false } = {}) {
  const config = loadConfig(repoRoot);
  const adapter = ADAPTERS[config.adapter] ?? genericAdapter;
  const ctx = await adapter.prepare({ repoRoot, config });

  const exts = adapter.extensions(config);

  // Dateien aus allen konfigurierten Roots sammeln (dedupliziert).
  const absFiles = [];
  for (const root of config.roots || ["."]) {
    const dir = root === "." ? repoRoot : join(repoRoot, root);
    walk(dir, { exts, out: absFiles });
  }

  const files = {};
  const seen = new Set();
  for (const abs of absFiles) {
    const rel = relative(repoRoot, abs);
    if (seen.has(rel) || rel.endsWith(".d.ts")) continue;
    seen.add(rel);
    try {
      files[rel] = adapter.parseFile({ absPath: abs, relPath: rel, repoRoot, config, ctx });
    } catch {
      files[rel] = { kind: "source", imports: [], externals: [], exports: [], isClient: false, models: [] };
    }
  }

  const graph = buildGraph(files, { config, ctx });
  const sync = gitSync(repoRoot);

  const outDir = join(repoRoot, config.out || ".cartograph");
  mkdirSync(outDir, { recursive: true });

  // graph.json bewusst OHNE sync (das ändert sich ständig → git-Rauschen).
  writeFileSync(join(outDir, "graph.json"), JSON.stringify(graph, null, 2) + "\n");

  // sync nur für die Anzeige in der Karte + Konsole.
  const md = renderArchitecture({ ...graph, sync }, config);
  writeFileSync(join(outDir, "ARCHITECTURE.md"), md);

  if (!silent) {
    if (quiet) console.log(`🗺️  Cartograph: Karte aktualisiert (${graph.stats.files} Dateien)`);
    else printSummary({ ...graph, sync }, config, outDir, repoRoot);
    warnWatchDrift(repoRoot, config);
  }
  return { ...graph, sync };
}

// Hinweis, wenn „kritischer" Code (config.watch) gestaged ist, aber kein memory/-Eintrag —
// hilft, das Projektwissen aktuell zu halten. Nur ein Hinweis, blockiert nichts.
function warnWatchDrift(repoRoot, config) {
  if (!config.watch || !config.watch.length) return;
  let staged;
  try {
    staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return;
  }
  if (!staged.length) return;
  const touchesWatch = staged.some((f) => config.watch.some((w) => f.includes(w)));
  const touchesMemory = staged.some((f) => f.includes(`${config.out}/memory`) || f.includes("/memory/"));
  if (touchesWatch && !touchesMemory) {
    console.log(`\n🔖 Cartograph: Du änderst als „kritisch" markierten Code (config.watch),`);
    console.log(`   aber keinen memory/-Eintrag. Gehört dazu eine Notiz/Entscheidung ins .cartograph/memory/?`);
  }
}

function printSummary(graph, config, outDir, repoRoot) {
  const s = graph.stats;
  console.log(`\n🗺️  Cartograph — ${graph.name}`);
  let line = `   Dateien: ${s.files}`;
  if (s.pages) line += ` · Seiten: ${s.pages}`;
  if (s.apiRoutes) line += ` · API: ${s.apiRoutes}`;
  if (s.components) line += ` · Komponenten: ${s.components}`;
  if (s.models) line += ` · Modelle: ${s.models}`;
  console.log(line);
  if (graph.usedTs === false && config.adapter === "typescript") {
    console.log(`   ℹ️  Light-Analyse — 'typescript' im Projekt nicht gefunden (für volle Tiefe: npm i -D typescript)`);
  }
  if (graph.sync) {
    const flag = graph.sync.behind > 0 ? `⚠️  ${graph.sync.behind} hinter origin/${graph.sync.branch}` : `✓ aktuell (${graph.sync.branch})`;
    console.log(`   Sync: ${flag}`);
  }
  console.log(`   → ${relative(repoRoot, outDir) || ".cartograph"}/graph.json + ARCHITECTURE.md\n`);
}
