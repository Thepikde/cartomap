// `cartograph init` (bestehendes ODER leeres Projekt) und `cartograph new <name>` (Greenfield-Wizard).
// Robust: crasht nicht im leeren Ordner. Idempotent: ueberschreibt vorhandene Dateien nicht.

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
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
    log(`✓ created cartograph.config.json (detected stack: ${describeStack(config)})`);
  } else {
    log("• cartograph.config.json already exists — left unchanged");
  }

  const indexPath = join(outDir, "memory", "INDEX.md");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, memoryIndexTemplate(config.name));
    writeFileSync(join(outDir, "memory", "decisions.md"), decisionsTemplate());
    log("✓ created .cartograph/memory/ (INDEX.md + decisions.md)");
  }

  ensureOutGitignore(outDir);
  ensureAgentBlock(repoRoot, config);

  await build(repoRoot, { silent: true });
  log("✓ built .cartograph/ARCHITECTURE.md");

  if (withHook) {
    const r = installHook(repoRoot);
    if (!r.ok) {
      log("• no git repo yet → hook skipped. Later: `git init` && `cartograph install-hook`");
    } else if (r.mode === "chained") {
      log(`✓ auto-update hooked into your existing ${r.into} pre-commit hook (your other hooks keep working)`);
    } else {
      log("✓ auto-update hook installed — the map refreshes on every commit");
    }
  }

  log(`\n🗺️  Cartograph is ready for "${config.name}".`);
  if (config.language === "unknown") {
    log("   Empty/unknown project — perfect: the memory grows with you from day one.");
  }
}

// Greenfield-Wizard: neuer Ordner + git init + Cartograph-Geruest.
export async function newProject(name, cwd) {
  const dir = join(cwd, name);
  if (existsSync(dir)) throw new Error(`folder "${name}" already exists.`);
  mkdirSync(dir, { recursive: true });
  try {
    execFileSync("git", ["init"], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    /* git missing — hook will be skipped */
  }
  log(`📁 created new project "${name}".`);
  await init(dir, { withHook: true });
  log(`\n👉 Next steps:`);
  log(`   cd ${name}`);
  log(`   # scaffold your project, e.g.:  npx create-next-app .   |   cargo init   |   …`);
  log(`   Cartograph is along from the first file — the map grows with every commit.`);
}

function describeStack(c) {
  return (
    [c.language, c.framework !== "none" ? c.framework : null, c.orm !== "none" ? c.orm : null]
      .filter(Boolean)
      .join(" · ") || "unknown"
  );
}

// graph.json wird nicht versioniert (grosse Diffs); ARCHITECTURE.md + memory schon.
function ensureOutGitignore(outDir) {
  const gi = join(outDir, ".gitignore");
  if (!existsSync(gi)) writeFileSync(gi, "graph.json\n");
}

// --- Agent-Block in CLAUDE.md / AGENTS.md (idempotent via Marker) ---

const START = "<!-- cartograph:start -->";
const END = "<!-- cartograph:end -->";

function agentBlock() {
  return `${START}
## 🗺️ Project map (Cartograph)

This project has an **auto-generated, always-current map** of its codebase. **Read it first**
before larger tasks — it saves tokens and prevents guessing:

- [\`.cartograph/ARCHITECTURE.md\`](.cartograph/ARCHITECTURE.md) — routes, data models, hubs, orphaned modules
- [\`.cartograph/memory/INDEX.md\`](.cartograph/memory/INDEX.md) — decisions, open points, project knowledge

The map updates automatically on every commit (Cartograph hook). Rebuild manually: \`cartograph build\`.
Knowledge files in \`memory/\` are hand-maintained — keep them current.
${END}`;
}

function ensureAgentBlock(repoRoot, config) {
  const target =
    existsSync(join(repoRoot, "AGENTS.md")) && !existsSync(join(repoRoot, "CLAUDE.md")) ? "AGENTS.md" : "CLAUDE.md";
  const p = join(repoRoot, target);
  const block = agentBlock();
  let content = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (content.includes(START)) {
    content = content.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    content = (content ? content.trimEnd() + "\n\n" : `# ${config.name}\n\n`) + block + "\n";
  }
  writeFileSync(p, content);
  log(`✓ added Cartograph block to ${target}`);
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
