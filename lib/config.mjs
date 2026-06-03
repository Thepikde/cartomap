// Lädt / erzeugt die cartomap.config.json eines Projekts.
// Reihenfolge: Auto-Erkennung (detect) liefert Defaults, eine vorhandene Datei überschreibt sie.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { detect } from "./detect.mjs";

export const CONFIG_NAME = "cartomap.config.json";

export function configPath(repoRoot) {
  return join(repoRoot, CONFIG_NAME);
}

// Sinnvolle Default-Config aus der Projekt-Erkennung ableiten.
export function defaultsFrom(repoRoot) {
  const d = detect(repoRoot);
  const docs = ["docs", "README.md", "AGENTS.md"].filter((x) => existsSync(join(repoRoot, x)));
  return {
    name: d.name || basename(repoRoot),
    language: d.language,
    framework: d.framework,
    adapter: d.adapter,
    orm: d.orm,
    roots: d.roots,
    aliases: d.aliases,
    // "watch" = Dateien/Ordner, deren Änderung der Hook melden soll (kritische Stellen).
    // Leer = aus; der Nutzer trägt projektspezifische Pfade ein.
    watch: [],
    // zusätzliche Ignore-Substrings (gemerged mit den eingebauten Defaults wie node_modules)
    ignore: [],
    docs,
    // Sprache der generierten Karte: "en" (Default) oder "de".
    lang: "en",
    out: ".cartomap",
  };
}

export function loadConfig(repoRoot) {
  const base = defaultsFrom(repoRoot);
  const p = configPath(repoRoot);
  if (existsSync(p)) {
    try {
      const file = JSON.parse(readFileSync(p, "utf8"));
      return { ...base, ...file };
    } catch {
      /* kaputte Config -> Defaults nutzen */
    }
  }
  return base;
}

export function writeConfig(repoRoot, config) {
  writeFileSync(configPath(repoRoot), JSON.stringify(config, null, 2) + "\n");
}

export function configExists(repoRoot) {
  return existsSync(configPath(repoRoot));
}
