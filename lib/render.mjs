// Erzeugt die ARCHITECTURE.md aus dem Graphen. Adaptiv: zeigt nur Abschnitte, die Daten haben
// (ein Python-CLI hat keine „Seiten", ein leeres Projekt nur den Kopf). Deterministisch sortiert.

export function renderArchitecture(graph, config) {
  const { name, stats, models, modelUsage, pages, apiRoutes, hubs, orphans, topExternals, byExt, sync, usedTs } = graph;
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`# 🗺️ ${name} — Architektur-Karte`);
  push(`> Auto-generiert von **Cartograph** (\`cartograph build\`) · NICHT von Hand editieren`);
  push("");
  const facts = [
    config.language && config.language !== "unknown" ? config.language : null,
    config.framework && config.framework !== "none" ? config.framework : null,
    config.orm && config.orm !== "none" ? config.orm : null,
  ].filter(Boolean);
  if (facts.length) push(`**Stack:** ${facts.join(" · ")}${usedTs === false ? " · _(Light-Analyse: `typescript` nicht im Projekt gefunden)_" : ""}`);
  push(`Projektwissen, Entscheidungen & offene Punkte → [\`memory/INDEX.md\`](memory/INDEX.md)`);

  if (sync && sync.behind > 0) {
    push("");
    push(`> ⚠️ **Achtung:** ${sync.behind} Commit(s) hinter \`origin/${sync.branch}\` — die Karte spiegelt evtl. veralteten Code. \`git pull\` empfohlen.`);
  }

  // Überblick
  push("");
  push("## Überblick");
  push("| Kennzahl | Wert |");
  push("|---|---|");
  push(`| Dateien | ${stats.files} |`);
  if (stats.pages) push(`| Seiten | ${stats.pages} |`);
  if (stats.apiRoutes) push(`| API-Routen | ${stats.apiRoutes} |`);
  if (stats.components) push(`| Komponenten | ${stats.components} |`);
  if (stats.libModules) push(`| lib-/util-Module | ${stats.libModules} |`);
  if (stats.models) push(`| Datenmodelle | ${stats.models} |`);
  if (stats.clientComponents) push(`| Client-Components | ${stats.clientComponents} |`);

  if (stats.files === 0) {
    push("");
    push("_Noch keine Quelldateien — die Karte wächst, sobald du Code hinzufügst und committest._");
    push("");
    return lines.join("\n") + "\n";
  }

  // Dateityp-Verteilung (v.a. bei polyglotten/generischen Projekten nützlich)
  const exts = Object.entries(byExt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (exts.length > 1) {
    push("");
    push("## Dateitypen");
    push(exts.map(([e, n]) => `\`${e}\` ${n}`).join(" · "));
  }

  if (pages.length) {
    push("");
    push(`## Seiten (${pages.length})`);
    for (const p of pages) push(`- \`${p.url}\` → ${p.file}`);
  }

  if (apiRoutes.length) {
    push("");
    push(`## API-Routen (${apiRoutes.length})`);
    const groups = {};
    for (const r of apiRoutes) {
      const segs = r.url.split("/").filter(Boolean);
      const key = segs[0] === "api" ? `/api/${segs[1] ?? "(root)"}` : "(sonstige)";
      (groups[key] ??= []).push(r);
    }
    for (const key of Object.keys(groups).sort()) {
      push("");
      push(`**${key}**`);
      for (const r of groups[key]) push(`- \`${r.url}\` · ${(r.methods || []).join(", ") || "—"} → ${r.file}`);
    }
  }

  if (models.length) {
    push("");
    push(`## Datenmodell — ${models.length} Modelle`);
    push("Modell ← Dateien, die es verwenden (Top 5):");
    push("");
    const sorted = [...models].sort((a, b) => (modelUsage[b]?.length ?? 0) - (modelUsage[a]?.length ?? 0) || a.localeCompare(b));
    for (const m of sorted) {
      const u = modelUsage[m] ?? [];
      push(`- **${m}** ← ${u.length}× ${u.length ? `· ${u.slice(0, 5).join(", ")}${u.length > 5 ? " …" : ""}` : "_(ungenutzt)_"}`);
    }
  }

  if (hubs.length) {
    push("");
    push("## Hubs (meist-importiert)");
    for (const h of hubs) push(`- ${h.file} ← ${h.inDegree}×`);
  }

  if (topExternals && topExternals.length) {
    push("");
    push("## Wichtigste externe Abhängigkeiten");
    push(topExternals.map((e) => `${e.name} (${e.count})`).join(" · "));
  }

  if (orphans.length) {
    push("");
    push("## Verwaiste Module");
    push("Kein eingehender Import (evtl. tot oder nur dynamisch genutzt):");
    for (const o of orphans.slice(0, 30)) push(`- ${o}`);
    if (orphans.length > 30) push(`- … +${orphans.length - 30} weitere`);
  }

  push("");
  return lines.join("\n") + "\n";
}
