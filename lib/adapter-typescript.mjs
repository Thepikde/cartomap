// TypeScript/JavaScript-Adapter: tiefe Analyse via TS-Compiler-AST.
// `typescript` wird LAZY aus dem Ziel-Projekt geladen (createRequire). Ist es nicht vorhanden,
// fällt der Adapter auf den generischen Regex-Parser zurück (crashfrei, etwas weniger präzise).
// Aliase kommen aus config.aliases (tsconfig paths). Next.js-Routen + ORM nur wenn erkannt.

import { readFileSync, statSync, existsSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { createRequire } from "node:module";
import { parseFile as genericParse } from "./adapter-generic.mjs";
import { attachRoutes } from "./routes.mjs";

export const id = "typescript";

const TS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function extensions(config) {
  return config?.extensions ?? TS_EXTS;
}

// typescript lazy aus dem Ziel-Projekt laden (nicht aus Cartograph selbst).
function loadTypeScript(repoRoot) {
  try {
    return createRequire(join(repoRoot, "package.json"))("typescript");
  } catch {
    try {
      return createRequire(import.meta.url)("typescript");
    } catch {
      return null;
    }
  }
}

function findPrismaSchema(repoRoot) {
  for (const c of [join(repoRoot, "prisma", "schema.prisma"), join(repoRoot, "schema.prisma")]) {
    if (existsSync(c)) return c;
  }
  return null;
}

function parsePrisma(schemaPath) {
  const src = readFileSync(schemaPath, "utf8");
  const models = [];
  for (const m of src.matchAll(/^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gm)) models.push(m[1]);
  models.sort();
  const accessorToModel = {};
  for (const name of models) accessorToModel[name.charAt(0).toLowerCase() + name.slice(1)] = name;
  return { models, accessorToModel };
}

export async function prepare({ repoRoot, config }) {
  const ts = loadTypeScript(repoRoot);
  const ctx = { ts, models: [], accessorToModel: {}, usedTs: !!ts };
  if (config.orm === "prisma") {
    const schema = findPrismaSchema(repoRoot);
    if (schema) Object.assign(ctx, parsePrisma(schema));
  }
  return ctx;
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// ORM-Modell-Nutzung per Textsuche (prisma.user. / db.user. …) — funktioniert in beiden Modi.
function detectModels(text, accessorToModel) {
  const out = new Set();
  if (accessorToModel && Object.keys(accessorToModel).length) {
    for (const m of text.matchAll(/\b(?:prisma|db|tx)\.([a-zA-Z][a-zA-Z0-9]*)\b/g)) {
      const model = accessorToModel[m[1]];
      if (model) out.add(model);
    }
  }
  return [...out].sort();
}

// Import-Auflösung mit konfigurierbaren Aliasen + relativen Pfaden.
function resolveImport(spec, fileAbsDir, repoRoot, aliases) {
  let base = null;
  for (const [from, to] of Object.entries(aliases || {})) {
    const key = from.replace(/\/$/, "");
    if (spec === key || spec.startsWith(from)) {
      base = resolve(repoRoot, to.replace(/\/$/, ""), spec.slice(from.length));
      break;
    }
  }
  if (!base) {
    if (spec.startsWith(".")) base = resolve(fileAbsDir, spec);
    else return null; // externes Paket
  }
  const cands = [base, ...TS_EXTS.map((e) => base + e), ...TS_EXTS.map((e) => join(base, "index" + e))];
  for (const c of cands) if (isFile(c)) return relative(repoRoot, c);
  return null;
}

function pkgName(spec) {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0];
}

function classifyTs(relPath, framework) {
  if (/(^|\/)middleware\.[tj]s$/.test(relPath)) return "middleware";
  if (/\.(test|spec)\.[tj]sx?$/.test(relPath) || relPath.includes("/__tests__/")) return "test";
  if (framework === "nextjs") {
    if (/(^|\/)app\//.test(relPath)) {
      if (/\/page\.[tj]sx?$/.test(relPath)) return "page";
      if (/\/route\.[tj]sx?$/.test(relPath)) return "api";
      if (/\/layout\.[tj]sx?$/.test(relPath)) return "layout";
    }
    if (/(^|\/)pages\//.test(relPath)) {
      return /(^|\/)pages\/api\//.test(relPath) ? "api" : "page";
    }
  }
  if (/(^|\/)components?\//.test(relPath)) return "component";
  if (/(^|\/)(lib|utils|helpers)\//.test(relPath)) return "lib";
  return "source";
}

export function parseFile({ absPath, relPath, repoRoot, config, ctx }) {
  const ts = ctx?.ts;
  const framework = config.framework;

  // Fallback ohne typescript: generischer Parser (inkl. Alias-Auflösung) + TS-Klassifizierung/Routen.
  if (!ts) {
    const g = genericParse({ absPath, relPath, repoRoot, config });
    g.kind = classifyTs(relPath, framework);
    let txt = "";
    try {
      txt = readFileSync(absPath, "utf8");
    } catch {
      /* egal */
    }
    g.models = detectModels(txt, ctx?.accessorToModel);
    attachRoutes(g, relPath, txt, framework);
    return g;
  }

  let text = "";
  try {
    text = readFileSync(absPath, "utf8");
  } catch {
    return { kind: "source", imports: [], externals: [], exports: [], isClient: false, models: [] };
  }

  const sf = ts.createSourceFile(
    relPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const imports = new Set();
  const externals = new Set();
  const exportNames = [];
  const apiMethods = new Set();
  let isClient = false;

  for (const stmt of sf.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteral(stmt.expression)) {
      if (stmt.expression.text === "use client") isClient = true;
    } else break;
  }

  const fileDir = dirname(absPath);
  const record = (spec) => {
    if (!spec) return;
    const resolved = resolveImport(spec, fileDir, repoRoot, config.aliases);
    if (resolved) imports.add(resolved);
    else if (!spec.startsWith(".")) externals.add(pkgName(spec));
  };
  const hasMod = (node, kind) => node.modifiers?.some((m) => m.kind === kind) ?? false;

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      record(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      record(node.arguments[0].text);
    }
    if (hasMod(node, ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        exportNames.push(node.name.text);
        if (HTTP_METHODS.has(node.name.text)) apiMethods.add(node.name.text);
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) {
            exportNames.push(d.name.text);
            if (HTTP_METHODS.has(d.name.text)) apiMethods.add(d.name.text);
          }
        }
      } else if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) {
        exportNames.push(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const out = {
    kind: classifyTs(relPath, framework),
    imports: [...imports].sort(),
    externals: [...externals].sort(),
    exports: exportNames,
    isClient,
    models: detectModels(text, ctx.accessorToModel),
  };
  attachRoutes(out, relPath, text, framework);
  return out;
}
