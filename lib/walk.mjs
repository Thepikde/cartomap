// Generischer rekursiver Datei-Scan. Überspringt typische Build-/Vendor-Ordner und
// versteckte Verzeichnisse. Sprach-/Framework-unabhängig.

import { readdirSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_IGNORE = new Set([
  "node_modules", ".git", ".next", ".nuxt", ".svelte-kit", "dist", "build", "out",
  ".cache", "coverage", ".turbo", ".vercel", "vendor", "__pycache__", ".venv", "venv",
  "target", ".gradle", "Pods", ".dart_tool", ".cartograph",
]);

/**
 * Sammelt rekursiv Dateien.
 * @param {string} dir - Startverzeichnis (absolut)
 * @param {{exts?: string[], ignore?: Set<string>, out?: string[]}} opts
 *   exts: nur diese Endungen (undefined = alle). ignore: Verzeichnisnamen zum Überspringen.
 */
export function walk(dir, { exts, ignore = DEFAULT_IGNORE, out = [] } = {}) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // versteckte Dateien/Ordner überspringen
    if (ignore.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, { exts, ignore, out });
    else if (!exts || exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
