// Generischer Adapter: erfasst Struktur + grobe Importe für (fast) jede Sprache per Regex.
// Weniger tief als der TypeScript-Adapter, aber crashfrei und überall lauffähig.
// Dient gleichzeitig als Fallback, wenn der TS-Adapter `typescript` nicht laden kann.

import { readFileSync, statSync } from "node:fs";
import { dirname, resolve, relative, join, extname } from "node:path";

export const id = "generic";

const EXTS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".php", ".rb", ".java", ".kt", ".kts", ".scala",
  ".swift", ".c", ".h", ".cpp", ".hpp", ".cc", ".cs",
  ".vue", ".svelte", ".astro",
];

export function extensions(config) {
  return config?.extensions ?? EXTS;
}

export async function prepare() {
  return {};
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// Sprach-abhängige Import-Extraktion. Gibt rohe Modul-Spezifizierer zurück.
function extractImports(text, ext) {
  const specs = [];
  const push = (m) => m && specs.push(m);
  const JS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"];
  if (JS.includes(ext)) {
    for (const m of text.matchAll(/\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) push(m[1]);
    for (const m of text.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) push(m[1]);
    for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) push(m[1]);
  } else if (ext === ".py") {
    for (const m of text.matchAll(/^\s*from\s+([.\w]+)\s+import/gm)) push(m[1]);
    for (const m of text.matchAll(/^\s*import\s+([.\w]+)/gm)) push(m[1]);
  } else if (ext === ".go") {
    for (const m of text.matchAll(/^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/gm)) push(m[1]);
    const block = text.match(/import\s*\(([\s\S]*?)\)/);
    if (block) for (const m of block[1].matchAll(/"([^"]+)"/g)) push(m[1]);
  } else if (ext === ".rs") {
    for (const m of text.matchAll(/^\s*use\s+([\w:]+)/gm)) push(m[1].split("::")[0]);
    for (const m of text.matchAll(/^\s*(?:pub\s+)?mod\s+(\w+)/gm)) push(m[1]);
  } else if (ext === ".php") {
    for (const m of text.matchAll(/^\s*use\s+([\w\\]+)/gm)) push(m[1]);
    for (const m of text.matchAll(/\b(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g)) push(m[1]);
  } else if (ext === ".rb") {
    for (const m of text.matchAll(/^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm)) push(m[1]);
  } else if ([".java", ".kt", ".kts", ".scala"].includes(ext)) {
    for (const m of text.matchAll(/^\s*import\s+([\w.]+)/gm)) push(m[1]);
  } else if ([".c", ".h", ".cpp", ".hpp", ".cc"].includes(ext)) {
    for (const m of text.matchAll(/^\s*#include\s+["<]([^">]+)[">]/gm)) push(m[1]);
  } else if (ext === ".cs") {
    for (const m of text.matchAll(/^\s*using\s+(?:static\s+)?([\w.]+)/gm)) push(m[1]);
  }
  return specs;
}

function resolveRelative(spec, fileDir, repoRoot, ext) {
  const base = resolve(fileDir, spec.replace(/\.(js|ts|jsx|tsx|mjs|cjs)$/, ""));
  const exts = [ext, ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".rs", ".php", ".rb"];
  const cands = [base];
  for (const e of exts) cands.push(base + e, join(base, "index" + e), join(base, "mod" + e), join(base, "__init__" + e));
  for (const c of cands) if (isFile(c)) return relative(repoRoot, c);
  return null;
}

// Python-spezifisch: in `from .util import x` / `from ..pkg.mod import x` sind die FÜHRENDEN Punkte
// Ebenen-Angaben (1 Punkt = aktuelles Paket, jeder weitere = eine Ebene hoch), die RESTLICHEN Punkte
// sind Modul-Trenner (..pkg.mod -> ../pkg/mod). Ziel: <x>.py oder <x>/__init__.py.
function resolvePythonRelative(spec, fileDir, repoRoot) {
  const m = spec.match(/^(\.+)(.*)$/);
  if (!m) return null;
  const dots = m[1].length;
  let baseDir = fileDir;
  for (let i = 0; i < dots - 1; i++) baseDir = dirname(baseDir);
  const sub = m[2] ? m[2].split(".").join("/") : "";
  const cands = sub ? [join(baseDir, sub) + ".py", join(baseDir, sub, "__init__.py")] : [join(baseDir, "__init__.py")];
  for (const c of cands) if (isFile(c)) return relative(repoRoot, c);
  return null;
}

export function classifyGeneric(relPath) {
  if (/(^|\/)(tests?|spec|__tests__)(\/|$)/i.test(relPath) || /\.(test|spec)\./i.test(relPath)) return "test";
  if (/(^|\/)(docs?|examples?)(\/)/i.test(relPath)) return "doc";
  return "source";
}

// Alias-Import auflösen (z.B. "@/lib/x" via config.aliases { "@/": "src/" }).
// Wichtig auch im Light-Modus, damit JS-Next-Projekte mit jsconfig.json korrekt verlinkt werden.
function resolveAlias(spec, aliases, repoRoot, ext) {
  for (const [from, to] of Object.entries(aliases || {})) {
    const key = from.replace(/\/$/, "");
    if (spec === key || spec.startsWith(from)) {
      const base = resolve(repoRoot, to.replace(/\/$/, ""), spec.slice(from.length));
      const exts = [ext, ".ts", ".tsx", ".js", ".jsx", ".mjs"];
      const cands = [base];
      for (const e of exts) cands.push(base + e, join(base, "index" + e));
      for (const c of cands) if (isFile(c)) return relative(repoRoot, c);
    }
  }
  return null;
}

export function parseFile({ absPath, relPath, repoRoot, config }) {
  let text = "";
  try {
    text = readFileSync(absPath, "utf8");
  } catch {
    /* unlesbar/binär */
  }
  const ext = extname(absPath);
  const specs = extractImports(text, ext);

  const imports = new Set();
  const externals = new Set();
  const fileDir = dirname(absPath);
  const aliases = config?.aliases || {};
  for (const spec of specs) {
    if (spec.startsWith(".")) {
      // Python löst relative Punkte anders auf als JS (führende Punkte = Ebenen).
      const resolved = ext === ".py" ? resolvePythonRelative(spec, fileDir, repoRoot) : resolveRelative(spec, fileDir, repoRoot, ext);
      if (resolved) imports.add(resolved);
    } else {
      const aliased = resolveAlias(spec, aliases, repoRoot, ext);
      if (aliased) imports.add(aliased);
      // Python: nur das Top-Level-Paket als extern führen (os.path -> os).
      else externals.add(ext === ".py" ? spec.split(".")[0] : spec.split(/[/\\]/)[0]);
    }
  }

  return {
    kind: classifyGeneric(relPath),
    imports: [...imports].sort(),
    externals: [...externals].sort(),
    exports: [],
    isClient: false,
    models: [],
  };
}
