// `cartograph init` (bestehendes ODER leeres Projekt) und `cartograph new <name>` (Greenfield-Wizard).
// Robust: crasht nicht im leeren Ordner. Idempotent: überschreibt vorhandene Dateien nicht.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, basename } from "node:path";
import { defaultsFrom, writeConfig, configExists } from "./config.mjs";
import { build } from "./build.mjs";
import { installHook } from "./hook.mjs";

const log = (m) => console.log(m);

export async function init(repoRoot, { withHook = true } = {}) {
  const config = defaultsFrom(repoRoot);
  const outDir = join(repoRoot, config.out);
  mkdirSync(join(outDir, "memory"), { recursive: true });

  if (!configExists(repoRoot)) {
    writeConfig(repoRoot, config);
    log("✓ cartograph.config.json erstellt (Stack erkannt: " + describeStack(config) + ")");
  } else {
    log("• cartograph.config.json existiert bereits — unverändert gelassen");
  }

  const indexPath = join(outDir, "memory", "INDEX.md");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, memoryIndexTemplate(config.name));
    writeFileSync(join(outDir, "memory", "decisions.md"), decisionsTemplate());
    log("✓ .cartograph/memory/ angelegt (INDEX.md + decisions.md)");
  }

  ensureAgentBlock(repoRoot, config);

  await build(repoRoot, { silent: true });
  log("✓ .cartograph/ARCHITECTURE.md gebaut");

  if (withHook) {
    const ok = installHook(repoRoot);
    log(ok
      ? "✓ Auto-Update-Hook aktiv — die Karte aktualisiert sich ab jetzt bei jedem Commit"
      : "• Kein git-Repo erkannt → Hook übersprungen. Später: `git init` && `cartograph install-hook`");
  }

  log(`\n🗺️  Cartograph ist bereit für „${config.name}".`);
  if (config.language === "unknown") {
    log("   Leeres/unbekanntes Projekt — perfekt: das Gedächtnis wächst ab jetzt von Tag 1 mit.");
  }
}

// Greenfield-Wizard: neuer Ordner + git init + Cartograph-Gerüst.
export async function newProject(name, cwd) {
  const dir = join(cwd, name);
  if (existsSync(dir)) throw new Error(`Ordner „${name}" existiert bereits.`);
  mkdirSync(dir, { recursive: true });
  try {
    execFileSync("git", ["init"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    /* git fehlt — Hook wird dann übersprungen */
  }
  log(`📁 Neues Projekt „${name}" angelegt.`);
  await init(dir, { withHook: true });
  log(`\n👉 Nächste Schritte:`);
  log(`   cd ${name}`);
  log(`   # dein Projekt aufbauen, z.B.:  npx create-next-app .   |   cargo init   |   …`);
  log(`   Cartograph ist ab der ersten Datei dabei — die Karte wächst mit jedem Commit.`);
}

function describeStack(c) {
  return [c.language, c.framework !== "none" ? c.framework : null, c.orm !== "none" ? c.orm : null]
    .filter(Boolean)
    .join(" · ") || "unbekannt";
}

// --- Agent-Block in CLAUDE.md / AGENTS.md (idempotent via Marker) ---

const START = "<!-- cartograph:start -->";
const END = "<!-- cartograph:end -->";

function agentBlock(config) {
  return `${START}
## 🗺️ Project map (Cartograph)

This project has an **auto-generated, always-current map** of its codebase. **Read it first**
before larger tasks — it saves tokens and prevents guessing:

- [\`.cartograph/ARCHITECTURE.md\`](.cartograph/ARCHITECTURE.md) — routes, data models, hubs, orphaned modules
- [\`.cartograph/memory/INDEX.md\`](.cartograph/memory/INDEX.md) — decisions, open points, project knowledge

The map updates automatically on every commit (Cartograph pre-commit hook). To rebuild manually:
\`cartograph build\`. Knowledge files in \`memory/\` are hand-maintained — keep them current.
${END}`;
}

function ensureAgentBlock(repoRoot, config) {
  const target = existsSync(join(repoRoot, "AGENTS.md")) && !existsSync(join(repoRoot, "CLAUDE.md"))
    ? "AGENTS.md"
    : "CLAUDE.md";
  const p = join(repoRoot, target);
  const block = agentBlock(config);
  let content = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (content.includes(START)) {
    content = content.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    content = (content ? content.trimEnd() + "\n\n" : `# ${config.name}\n\n`) + block + "\n";
  }
  writeFileSync(p, content);
  log(`✓ ${target} um Cartograph-Block ergänzt`);
}

// --- Templates ---

function memoryIndexTemplate(name) {
  return `# 📚 Project Memory — ${name}

Living knowledge that is **not** derivable from code: decisions, the "why", conventions, open
points, gotchas. Lives **in git** → the whole team and the AI share the same state.

## How it works
- One note = one file = one thought. Keep it short.
- Cross-link with \`[[filename-without-ext]]\` (Obsidian-compatible).
- Architecture facts (routes, models, hubs) live in [\`../ARCHITECTURE.md\`](../ARCHITECTURE.md) (auto-generated).

## Notes
- [[decisions]] — key decisions and their rationale
`;
}

function decisionsTemplate() {
  return `# Decisions

Record important choices here as you make them — that's what makes the memory "perfect from day one".

Format per entry:

## <short title>
**Decision:** …
**Why:** …
**Date:** …
`;
}
