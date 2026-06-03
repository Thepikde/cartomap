// Smoke-/Snapshot-Tests gegen Fixture-Projekte. Lädt build() und prüft die Karten-Kennzahlen.
// Läuft mit Node's eingebautem Test-Runner: `npm test` (node --test). Keine Dependencies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "../lib/build.mjs";
import { buildGraph } from "../lib/graph.mjs";
import { reverseDeps, dependentsOf, computeAffected, resolveFileKey } from "../lib/affected.mjs";
import { detectEntryPoints } from "../lib/entrypoints.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const run = (name) => build(join(FIX, name), { silent: true });

test("next-app: app-router pages + api routes + prisma model", async () => {
  const g = await run("next-app");
  assert.ok(g.pages.some((p) => p.url === "/blog/:slug"), "page /blog/:slug");
  assert.ok(
    g.apiRoutes.some((r) => r.url === "/api/users" && r.methods.includes("GET") && r.methods.includes("POST")),
    "GET+POST /api/users"
  );
  assert.ok(g.models.includes("User"), "User model detected");
  assert.ok((g.modelUsage.User || []).length >= 1, "User model used by the route");
});

test("next-pages: pages-router pages + api", async () => {
  const g = await run("next-pages");
  assert.ok(g.pages.some((p) => p.url === "/"), "page /");
  assert.ok(g.pages.some((p) => p.url === "/blog/:slug"), "page /blog/:slug");
  assert.ok(g.apiRoutes.some((r) => r.url === "/api/users"), "/api/users");
});

test("nestjs: @Controller/@Get decorators -> endpoints", async () => {
  const g = await run("nestjs");
  assert.ok(
    g.apiRoutes.some((r) => r.url === "/users" && r.methods.includes("GET") && r.methods.includes("POST")),
    "GET+POST /users"
  );
  assert.ok(g.apiRoutes.some((r) => r.url === "/users/:id" && r.methods.includes("GET")), "GET /users/:id");
});

test("express: app.get/router.post -> endpoints", async () => {
  const g = await run("express");
  assert.ok(g.apiRoutes.some((r) => r.url === "/health" && r.methods.includes("GET")), "GET /health");
  assert.ok(g.apiRoutes.some((r) => r.url === "/users/:id" && r.methods.includes("DELETE")), "DELETE /users/:id");
});

test("python: generic adapter parses without crashing", async () => {
  const g = await run("python");
  assert.ok(g.stats.files >= 2, "python files found");
});

test("empty: no crash, zero source files", async () => {
  const g = await run("empty");
  assert.equal(g.stats.files, 0, "no source files");
});

test("affected: reverse graph is built and is cycle-safe", () => {
  // a → b → c, d → b, plus ein bewusster Zyklus c → a (darf nicht endlos laufen)
  const files = {
    "a.js": { imports: ["b.js"] },
    "b.js": { imports: ["c.js"] },
    "c.js": { imports: ["a.js"] },
    "d.js": { imports: ["b.js"] },
    "leaf.js": { imports: [] },
  };
  const rev = reverseDeps(files);
  assert.deepEqual(rev["b.js"], ["a.js", "d.js"], "direct importers of b");
  const depC = dependentsOf(rev, "c.js");
  assert.ok(["a.js", "b.js", "d.js"].every((f) => depC.includes(f)), "a, b, d transitively depend on c");
  assert.ok(!depC.includes("c.js"), "target excludes itself even with a cycle");
  assert.deepEqual(dependentsOf(rev, "leaf.js"), [], "nothing depends on leaf");
});

test("affected: computeAffected + resolveFileKey (exact, suffix, error)", () => {
  const graph = { files: { "src/a.ts": { imports: ["src/b.ts"] }, "src/b.ts": { imports: [] } } };
  assert.equal(resolveFileKey(graph, "src/b.ts", "/repo"), "src/b.ts", "exact match");
  assert.equal(resolveFileKey(graph, "b.ts", "/repo"), "src/b.ts", "suffix match");
  const r = computeAffected(graph, "src/b.ts");
  assert.deepEqual(r.direct, ["src/a.ts"]);
  assert.deepEqual(r.transitive, ["src/a.ts"]);
  assert.throws(() => resolveFileKey(graph, "nope.ts", "/repo"), /not in the map/);
});

test("hubs carry a transitive 'affected' blast-radius count", () => {
  // b → a → c : c wird direkt von a importiert (inDegree 1), transitiv auch von b (affected 2)
  const files = {
    "a.js": { kind: "lib", imports: ["c.js"], externals: [], models: [] },
    "b.js": { kind: "lib", imports: ["a.js"], externals: [], models: [] },
    "c.js": { kind: "lib", imports: [], externals: [], models: [] },
  };
  const g = buildGraph(files, { config: { name: "t" }, ctx: { models: [] } });
  const c = g.hubs.find((h) => h.file === "c.js");
  assert.ok(c && c.inDegree === 1 && c.affected === 2, "c: 1 direct, 2 affected");
});

test("entry points: convention (python) + framework (next) + bin", async () => {
  const py = await run("python");
  assert.ok((py.entryPoints || []).some((e) => e.file === "app.py"), "python app.py is an entry point");
  const next = await run("next-app");
  assert.ok((next.entryPoints || []).some((e) => /app\/page\.tsx$/.test(e.file)), "next app/page.tsx is an entry point");
  // synthetisch: konventionelle CLI-Datei unter bin/ wird erkannt
  const eps = detectEntryPoints({ repoRoot: "/x", config: { roots: ["bin"], framework: "none" }, files: { "bin/cli.mjs": {} } });
  assert.ok(eps.some((e) => e.file === "bin/cli.mjs"), "bin/cli.mjs detected");
});
