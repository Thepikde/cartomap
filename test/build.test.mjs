// Smoke-/Snapshot-Tests gegen Fixture-Projekte. Lädt build() und prüft die Karten-Kennzahlen.
// Läuft mit Node's eingebautem Test-Runner: `npm test` (node --test). Keine Dependencies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "../lib/build.mjs";

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
