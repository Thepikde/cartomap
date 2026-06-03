// Liefert die zu analysierenden Dateien (absolute Pfade).
// Bevorzugt `git ls-files` (respektiert .gitignore, schnell), faellt im Nicht-git/leeren Repo
// auf den rekursiven walk zurueck. Filtert nach roots, Endungen und config.ignore.

import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { walk, DEFAULT_IGNORE } from "./walk.mjs";

function tryGitLsFiles(repoRoot) {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
    );
    return out.split("\0").filter(Boolean);
  } catch {
    return null; // kein git-Repo
  }
}

function inRoots(rel, roots) {
  if (!roots || roots.includes(".")) return true;
  return roots.some((r) => {
    const root = r.replace(/\/$/, "");
    return rel === root || rel.startsWith(root + "/");
  });
}

function isIgnored(rel, patterns) {
  // Sicherheitsnetz: typische Build-/Vendor-Ordner, auch falls .gitignore sie nicht listet.
  if (rel.split("/").some((seg) => DEFAULT_IGNORE.has(seg))) return true;
  return patterns.some((p) => p && rel.includes(p));
}

export function scan(repoRoot, { roots = ["."], exts, ignore = [] } = {}) {
  let rels = tryGitLsFiles(repoRoot);

  if (rels == null) {
    // Fallback ohne git: rekursiv laufen (DEFAULT_IGNORE bremst node_modules etc. aus).
    const abs = [];
    for (const root of roots) {
      const dir = root === "." ? repoRoot : join(repoRoot, root);
      walk(dir, { exts, out: abs });
    }
    rels = abs.map((a) => relative(repoRoot, a));
  }

  const seen = new Set();
  const result = [];
  for (const rel of rels) {
    if (seen.has(rel)) continue;
    if (!inRoots(rel, roots)) continue;
    if (exts && !exts.some((e) => rel.endsWith(e))) continue;
    if (rel.endsWith(".d.ts")) continue;
    if (isIgnored(rel, ignore)) continue;
    seen.add(rel);
    result.push(join(repoRoot, rel));
  }
  return result;
}
