// Baut aus den geparsten Dateien den Graphen: Routen, Modell-Nutzung, Hubs, verwaiste Module,
// externe Abhängigkeiten, Dateityp-Verteilung. Komplett adaptiv — was nicht da ist, bleibt leer.

import { extname } from "node:path";

export function buildGraph(files, { config, ctx }) {
  const entries = Object.entries(files).sort((a, b) => a[0].localeCompare(b[0]));

  // Routen (nur falls der Adapter welche geliefert hat).
  // Seiten: eine URL pro Datei. API: endpoints[] → nach URL gruppiert (eine Datei kann mehrere haben).
  const pages = [];
  const apiRoutes = [];
  for (const [rel, info] of entries) {
    if (info.kind === "page" && info.route != null) {
      pages.push({ url: info.route, file: rel });
    } else if (info.endpoints && info.endpoints.length) {
      const byUrl = {};
      for (const ep of info.endpoints) (byUrl[ep.url] ??= new Set()).add(ep.method);
      for (const url of Object.keys(byUrl)) {
        apiRoutes.push({ url, methods: [...byUrl[url]].sort(), file: rel });
      }
    }
  }
  pages.sort((a, b) => a.url.localeCompare(b.url));
  apiRoutes.sort((a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file));

  // Datenmodell-Nutzung
  const models = ctx?.models || [];
  const modelUsage = {};
  for (const m of models) modelUsage[m] = [];
  for (const [rel, info] of entries) for (const m of info.models || []) modelUsage[m]?.push(rel);
  for (const m of models) modelUsage[m]?.sort();

  // Hubs + verwaiste Module (eingehende Imports)
  const inDegree = {};
  for (const [, info] of entries) for (const imp of info.imports || []) inDegree[imp] = (inDegree[imp] || 0) + 1;
  const hubs = Object.entries(inDegree)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([file, n]) => ({ file, inDegree: n }));
  const orphans = entries
    .filter(([rel, info]) => ["component", "lib", "source", "data", "other"].includes(info.kind) && !inDegree[rel])
    .map(([rel]) => rel)
    .sort();

  // Wichtigste externe Abhängigkeiten
  const extCount = {};
  for (const [, info] of entries) for (const e of info.externals || []) extCount[e] = (extCount[e] || 0) + 1;
  const topExternals = Object.entries(extCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  // Dateityp-Verteilung
  const byExt = {};
  for (const rel of Object.keys(files)) {
    const e = extname(rel) || "(none)";
    byExt[e] = (byExt[e] || 0) + 1;
  }

  const stats = {
    files: entries.length,
    pages: pages.length,
    apiRoutes: apiRoutes.length,
    components: entries.filter(([, i]) => i.kind === "component").length,
    libModules: entries.filter(([, i]) => i.kind === "lib").length,
    models: models.length,
    clientComponents: entries.filter(([, i]) => i.isClient).length,
  };

  return {
    name: config.name,
    generatedBy: "cartograph",
    stats,
    models,
    modelUsage,
    pages,
    apiRoutes,
    hubs,
    orphans,
    topExternals,
    byExt,
    usedTs: ctx?.usedTs,
    files: Object.fromEntries(entries),
  };
}
