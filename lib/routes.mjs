// Routen-/Endpoint-Extraktion pro Framework. Regex-basiert → funktioniert auch im Light-Modus
// (ohne TS-Compiler). Liefert pro Datei eine Liste von { method, url } bzw. eine Seiten-URL.

function normalizeUrl(u) {
  if (!u) return "/";
  let s = u.trim();
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/+/g, "/").replace(/\/$/, "");
  return s || "/";
}

// Dateipfad-Segment -> URL-Segment (Next-Konventionen: [slug] -> :slug, [...x] -> *)
function segToUrl(seg) {
  if (seg.startsWith("[[...")) return "*";
  if (seg.startsWith("[...")) return "*";
  if (seg.startsWith("[")) return ":" + seg.replace(/^\[+|\]+$/g, "").replace(/^\.\.\./, "");
  return seg;
}

// Next.js App-Router:  app/(public)/blog/[slug]/page.tsx -> /blog/:slug
export function nextAppRoute(relPath) {
  const m = relPath.match(/(?:^|\/)app\/(.*)$/);
  if (!m) return null;
  const p = m[1].replace(/\/?(page|route|layout)\.[tj]sx?$/, "");
  const segs = p.split("/").filter(Boolean).filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return normalizeUrl(segs.map(segToUrl).join("/"));
}

// Next.js Pages-Router:  pages/blog/[slug].tsx -> /blog/:slug ; pages/api/users.ts -> /api/users
// Gibt { url, isApi } zurück (Pages-Router mischt Seiten und API unter pages/api/).
export function nextPagesRoute(relPath) {
  const m = relPath.match(/(?:^|\/)pages\/(.*)\.[tj]sx?$/);
  if (!m) return null;
  let p = m[1];
  if (p === "index") p = "";
  else if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  if (p === "_app" || p === "_document" || p === "_error") return null; // Spezialdateien, keine Route
  const isApi = p === "api" || p.startsWith("api/");
  const segs = p.split("/").filter(Boolean).map(segToUrl);
  return { url: normalizeUrl(segs.join("/")), isApi };
}

// NestJS:  @Controller('users') + @Get(':id') -> { GET, /users/:id }
export function nestEndpoints(text) {
  const ctrl = text.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
  if (!ctrl) return [];
  const prefix = ctrl[1] ? "/" + ctrl[1].replace(/^\//, "") : "";
  const out = [];
  const re = /@(Get|Post|Put|Patch|Delete|Head|Options|All)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const method = m[1].toUpperCase();
    const sub = m[2] ? "/" + m[2].replace(/^\//, "") : "";
    out.push({ method, url: normalizeUrl(prefix + sub) });
  }
  return out;
}

// Express / Fastify / Koa-Router:  app.get('/x', …) / router.post('/y', …)
export function expressEndpoints(text) {
  const out = [];
  const re = /\b(?:app|router|server|fastify|api|r)\.(get|post|put|patch|delete|head|options|all)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ method: m[1].toUpperCase(), url: normalizeUrl(m[2]) });
  }
  return out;
}

// Next.js App-Router route.ts: exportierte HTTP-Handler (export async function GET / export const POST)
export function nextApiMethods(text) {
  const out = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+function|const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    out.add(m[1]);
  }
  return [...out];
}

// Hängt Routen/Endpoints framework-abhängig an das Parse-Ergebnis (mutiert `out`).
// Einheitlich für AST- und Light-Modus (rein textbasiert).
export function attachRoutes(out, relPath, text, framework) {
  if (framework === "nextjs") {
    const isApp = /(^|\/)app\//.test(relPath);
    if (isApp && out.kind === "page") {
      out.route = nextAppRoute(relPath);
      return;
    }
    if (isApp && out.kind === "api") {
      const url = nextAppRoute(relPath);
      const methods = nextApiMethods(text);
      out.endpoints = (methods.length ? methods : ["GET"]).map((method) => ({ method, url }));
      return;
    }
    // Pages-Router (pages/…)
    const pg = nextPagesRoute(relPath);
    if (pg) {
      if (pg.isApi) {
        out.kind = "api";
        out.endpoints = [{ method: "ALL", url: pg.url }];
      } else {
        out.kind = "page";
        out.route = pg.url;
      }
    }
  } else if (framework === "nestjs") {
    const eps = nestEndpoints(text);
    if (eps.length) {
      out.kind = "api";
      out.endpoints = eps;
    }
  } else if (framework === "node-server") {
    const eps = expressEndpoints(text);
    if (eps.length) {
      out.kind = "api";
      out.endpoints = eps;
    }
  }
}
