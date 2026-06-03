// Liest den git-Sync-Status (ohne fetch — Stand des letzten fetch).
// execFileSync mit Argument-Array statt Shell-String -> keine Command-Injection.

import { execFileSync } from "node:child_process";

export function gitSync(repoRoot) {
  try {
    // stdio stderr=ignore: keine "fatal: not a git repository"-Leaks bei Nicht-Repos.
    const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const branch = git("rev-parse", "--abbrev-ref", "HEAD");
    let behind = 0;
    let ahead = 0;
    try {
      const counts = git("rev-list", "--left-right", "--count", `origin/${branch}...HEAD`);
      const [b, a] = counts.split(/\s+/).map(Number);
      behind = b || 0;
      ahead = a || 0;
    } catch {
      /* kein origin-Ref vorhanden */
    }
    const dirty = git("status", "--porcelain").split("\n").filter(Boolean).length;
    return { branch, behind, ahead, dirty };
  } catch {
    return null; // kein git-Repo
  }
}
