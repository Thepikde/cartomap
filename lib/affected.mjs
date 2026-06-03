// Impact-/Blast-Radius-Analyse: "Was geht kaputt, wenn ich diese Datei ändere?"
// Baut aus den (bereits repo-relativ aufgelösten) info.imports den Reverse-Graphen und liefert
// die transitive Menge der Dateien, die auf eine Datei angewiesen sind.
// Bewusst rein statisch (Untergrenze) — dynamische import(), DI und Framework-Routing tauchen nicht auf.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { loadConfig } from "./config.mjs";

// Reverse-Abhängigkeiten: { datei: [direkte Importeure …] } — dedupliziert + sortiert.
// Eingabe: files = { relPath: { imports: [relPath …] } } (forward edges).
export function reverseDeps(files) {
  const rev = {};
  for (const k of Object.keys(files || {})) rev[k] = [];
  for (const [importer, info] of Object.entries(files || {})) {
    for (const dep of info?.imports || []) (rev[dep] ??= []).push(importer);
  }
  for (const k of Object.keys(rev)) rev[k] = [...new Set(rev[k])].sort();
  return rev;
}

// Transitive Hülle über den Reverse-Graphen: alle Dateien, die (direkt oder indirekt) `target`
// importieren. Zyklensicher (visited-Set), `target` selbst ist ausgeschlossen. Index-BFS statt shift().
export function dependentsOf(rev, target) {
  const seen = new Set();
  const queue = [...(rev[target] || [])];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === target || seen.has(cur)) continue;
    seen.add(cur);
    for (const up of rev[cur] || []) if (!seen.has(up)) queue.push(up);
  }
  return [...seen].sort();
}

// Bequeme Kombi: direkte Importeure + transitive Menge für eine Datei aus einem graph.json-Objekt.
export function computeAffected(graph, fileKey) {
  const rev = reverseDeps(graph.files || {});
  return { direct: [...(rev[fileKey] || [])], transitive: dependentsOf(rev, fileKey) };
}

// Nutzer-Eingabe (z.B. "lib/graph.mjs", "./lib/graph.mjs", absoluter Pfad oder nur "graph.mjs")
// auf einen echten Schlüssel im Graphen abbilden. Wirft mit hilfreicher Meldung bei Mehrdeutigkeit/Fehlschlag.
export function resolveFileKey(graph, arg, repoRoot) {
  const keys = Object.keys(graph.files || {});
  let a = String(arg).replace(/\\/g, "/").replace(/^\.\//, "");
  if (a.startsWith("/")) {
    const rel = relative(repoRoot, a).replace(/\\/g, "/");
    if (rel && !rel.startsWith("..")) a = rel;
  }
  if (graph.files?.[a]) return a;

  const suffix = keys.filter((k) => k === a || k.endsWith("/" + a));
  const base = a.split("/").pop();
  const pool = suffix.length ? suffix : keys.filter((k) => k.split("/").pop() === base);

  if (pool.length === 1) return pool[0];
  if (pool.length > 1) {
    const err = new Error(`"${arg}" is ambiguous — it matches ${pool.length} files:\n` + pool.slice(0, 10).map((k) => "    " + k).join("\n") + `\nPass a more specific path.`);
    err.code = "AMBIGUOUS";
    throw err;
  }
  const err = new Error(`"${arg}" is not in the map. Check the path, then run \`cartomap build\` to refresh.`);
  err.code = "NOT_FOUND";
  throw err;
}

// CLI-Orchestrierung: graph.json laden, Datei auflösen, Impact berechnen, ausgeben.
export async function affected(repoRoot, fileArg, { json = false } = {}) {
  const config = loadConfig(repoRoot);
  const graphPath = join(repoRoot, config.out || ".cartomap", "graph.json");
  if (!existsSync(graphPath)) {
    throw new Error(`No map found at ${relative(repoRoot, graphPath)} — run \`cartomap build\` first.`);
  }
  let graph;
  try {
    graph = JSON.parse(readFileSync(graphPath, "utf8"));
  } catch {
    throw new Error(`Could not read ${relative(repoRoot, graphPath)} (corrupt?). Re-run \`cartomap build\`.`);
  }
  if (!graph.files || !Object.keys(graph.files).length) {
    throw new Error("The map has no files yet — add some source and run `cartomap build`.");
  }

  const key = resolveFileKey(graph, fileArg, repoRoot);
  const { direct, transitive } = computeAffected(graph, key);

  if (json) {
    process.stdout.write(JSON.stringify({ file: key, directDependents: direct, dependents: transitive }, null, 2) + "\n");
    return { file: key, direct, transitive };
  }
  printAffected({ key, direct, transitive, graph, config });
  return { file: key, direct, transitive };
}

function printAffected({ key, direct, transitive, graph, config }) {
  const indirect = transitive.filter((f) => !direct.includes(f));
  console.log(`\n🗺️  Impact of changing  ${key}`);
  if (!transitive.length) {
    console.log("   Nothing imports this file (statically) — safe to change in isolation.");
  } else {
    console.log(`   ${transitive.length} file(s) depend on it — ${direct.length} directly${indirect.length ? `, ${indirect.length} indirectly` : ""}.`);
    console.log("\n   Direct importers:");
    for (const f of direct) console.log(`     • ${f}`);
    if (indirect.length) {
      console.log("\n   Indirect (transitive):");
      for (const f of indirect.slice(0, 40)) console.log(`     • ${f}`);
      if (indirect.length > 40) console.log(`     … +${indirect.length - 40} more`);
    }
  }
  // Ehrlichkeits-Hinweis — niemals vortäuschen, dass die Liste vollständig ist.
  const light = config.adapter === "generic" || graph.usedTs === false ? " Heuristic import detection (no deep TS parse) may also miss some." : "";
  console.log(`\n   ⚠️  Static imports only — dynamic import(), DI and framework routing aren't tracked, so this is a lower bound.${light}`);
  console.log("");
}
