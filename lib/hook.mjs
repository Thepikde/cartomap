// Installiert den Auto-Update-Hook: kopiert die Hook-Vorlage nach .cartograph/hooks/ (versioniert,
// team-tauglich) und setzt git core.hooksPath darauf. Einmal pro Checkout nötig.

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "pre-commit");

export function installHook(repoRoot) {
  // Ist es ein git-Repo?
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { cwd: repoRoot, stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    return false;
  }

  const hooksDir = join(repoRoot, ".cartograph", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const dest = join(hooksDir, "pre-commit");
  copyFileSync(HOOK_TEMPLATE, dest);
  chmodSync(dest, 0o755);
  execFileSync("git", ["config", "core.hooksPath", ".cartograph/hooks"], { cwd: repoRoot });
  return true;
}
