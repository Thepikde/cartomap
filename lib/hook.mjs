// Installiert den Auto-Update-Hook — OHNE bestehende Hook-Systeme (Husky, lefthook, eigene
// .git/hooks) zu zerstoeren. Strategie:
//   - Existiert bereits ein Hook-System  -> in dessen pre-commit EINKLINKEN (idempotent, chaining)
//   - Sonst                              -> eigener .cartograph/hooks + core.hooksPath (team-tauglich)

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "pre-commit");

const CHAIN_MARKER = "# >>> cartograph >>>";
const CHAIN_BLOCK = `${CHAIN_MARKER}
# Keep the Cartograph map up to date on every commit (added by \`cartograph install-hook\`).
if command -v cartograph >/dev/null 2>&1; then
  cartograph build --quiet 2>/dev/null && git add "$(git rev-parse --show-toplevel)/.cartograph/ARCHITECTURE.md" 2>/dev/null || true
fi
# <<< cartograph <<<`;

function git(repoRoot, args, opts = {}) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...opts }).trim();
}

function isGitRepo(repoRoot) {
  try {
    git(repoRoot, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

function gitDirAbs(repoRoot) {
  const d = git(repoRoot, ["rev-parse", "--git-dir"]);
  return isAbsolute(d) ? d : join(repoRoot, d);
}

// Erkennt ein bereits aktives Hook-System, in das wir uns einklinken sollten.
function detectExistingHooks(repoRoot) {
  // 1) core.hooksPath bereits gesetzt (z.B. Husky nutzt .husky)?
  let hooksPath = "";
  try {
    hooksPath = git(repoRoot, ["config", "core.hooksPath"]);
  } catch {
    /* nicht gesetzt */
  }
  if (hooksPath && hooksPath !== ".cartograph/hooks") {
    const dir = isAbsolute(hooksPath) ? hooksPath : join(repoRoot, hooksPath);
    return { kind: "hooksPath", preCommit: join(dir, "pre-commit") };
  }
  // 2) Husky-Verzeichnis vorhanden?
  if (existsSync(join(repoRoot, ".husky"))) {
    return { kind: "husky", preCommit: join(repoRoot, ".husky", "pre-commit") };
  }
  // 3) Eigener (nicht-Sample) .git/hooks/pre-commit?
  const pc = join(gitDirAbs(repoRoot), "hooks", "pre-commit");
  if (existsSync(pc)) return { kind: "githooks", preCommit: pc };
  return null;
}

function chainInto(existing) {
  let content = existsSync(existing.preCommit) ? readFileSync(existing.preCommit, "utf8") : "#!/bin/sh\n";
  if (content.includes(CHAIN_MARKER)) return; // schon eingeklinkt -> idempotent
  if (!content.startsWith("#!")) content = "#!/bin/sh\n" + content;
  writeFileSync(existing.preCommit, content.trimEnd() + "\n\n" + CHAIN_BLOCK + "\n");
  try {
    chmodSync(existing.preCommit, 0o755);
  } catch {
    /* egal */
  }
}

/**
 * @returns {{ok:boolean, mode?:"chained"|"hooksPath", into?:string, reason?:string}}
 */
export function installHook(repoRoot) {
  if (!isGitRepo(repoRoot)) return { ok: false, reason: "not-a-git-repo" };

  const existing = detectExistingHooks(repoRoot);
  if (existing) {
    mkdirSync(dirname(existing.preCommit), { recursive: true });
    chainInto(existing);
    return { ok: true, mode: "chained", into: existing.kind };
  }

  // Kein bestehendes System -> eigener, team-tauglicher Hook im Repo.
  const hooksDir = join(repoRoot, ".cartograph", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const dest = join(hooksDir, "pre-commit");
  copyFileSync(HOOK_TEMPLATE, dest);
  chmodSync(dest, 0o755);
  git(repoRoot, ["config", "core.hooksPath", ".cartograph/hooks"]);
  return { ok: true, mode: "hooksPath" };
}
