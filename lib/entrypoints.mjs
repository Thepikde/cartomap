// Einstiegspunkte erkennen ("Wo fange ich an zu lesen?"): aus package.json (bin/main/module),
// aus dem Framework (Next.js-Root-Page/Layout) und aus konventionellen Dateinamen (index/main/app …)
// an flachen Stellen (Repo-Root, ein config.root, bin/, cmd/*). Deterministisch + erklärbar (why-Key).
// Es werden NUR Dateien aufgenommen, die wirklich gescannt wurden (nie auf dist-Builds zeigen).

import { join } from "node:path";
import { readJsonLoose } from "./detect.mjs";

const CONV = /(^|\/)(index|main|app|server|cli|__main__|manage)\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|php)$/;

const dirOf = (f) => (f.lastIndexOf("/") < 0 ? "" : f.slice(0, f.lastIndexOf("/")));
const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "");

export function detectEntryPoints({ repoRoot, config, files }) {
  const fileSet = new Set(Object.keys(files || {}));
  const out = [];
  const seen = new Set();
  const add = (file, why) => {
    const f = norm(file);
    if (!f || seen.has(f) || !fileSet.has(f)) return; // nur echte, gescannte Quelldateien
    seen.add(f);
    out.push({ file: f, why });
  };

  // 1) package.json: bin (CLI-Einstiege) zuerst, dann main/module
  const pkg = readJsonLoose(join(repoRoot, "package.json"));
  if (pkg) {
    if (typeof pkg.bin === "string") add(pkg.bin, "bin");
    else if (pkg.bin && typeof pkg.bin === "object") for (const v of Object.values(pkg.bin)) add(v, "bin");
    add(pkg.main, "main");
    add(pkg.module, "module");
  }

  // 2) Framework-Einstiege (aktuell Next.js — App- und Pages-Router)
  if (config.framework === "nextjs") {
    for (const f of fileSet) {
      if (/(^|\/)app\/page\.[tj]sx?$/.test(f)) add(f, "next-page");
      else if (/(^|\/)app\/layout\.[tj]sx?$/.test(f)) add(f, "next-layout");
      else if (/(^|\/)pages\/index\.[tj]sx?$/.test(f)) add(f, "next-home");
      else if (/(^|\/)pages\/_app\.[tj]sx?$/.test(f)) add(f, "next-shell");
    }
  }

  // 3) Konventionelle Einstiegsdateien — nur an flachen Stellen, sonst würde jede barrel-index.ts auftauchen
  const roots = new Set((config.roots || []).map((r) => (r === "." ? "" : norm(r).replace(/\/$/, ""))));
  const shallow = (f) => {
    const d = dirOf(f);
    return d === "" || roots.has(d) || d === "bin" || /^cmd\/[^/]+$/.test(d);
  };
  for (const f of [...fileSet].filter((f) => CONV.test(f) && shallow(f)).sort()) add(f, "convention");

  return out.slice(0, 6);
}
