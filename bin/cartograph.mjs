#!/usr/bin/env node
// Cartograph CLI — a living project memory for AI coding.
//   cartograph init            set up Cartograph in the current project (empty or existing)
//   cartograph new <name>      create a new project folder with Cartograph from day 1
//   cartograph build           (re)build the map  [--quiet]
//   cartograph install-hook    enable auto-update on every commit
//   cartograph help

import { init, newProject } from "../lib/init.mjs";
import { build } from "../lib/build.mjs";
import { installHook } from "../lib/hook.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const args = argv.slice(1).filter((a) => !a.startsWith("--"));
const cwd = process.cwd();

const HELP = `🗺️  Cartograph — a living, always-current map of your codebase for AI coding.

Usage:
  cartograph init            Set up Cartograph here (works in an empty OR existing project)
  cartograph new <name>      Create a new project folder with Cartograph from day 1
  cartograph build           (Re)build the map into .cartograph/   [--quiet]
  cartograph install-hook    Enable auto-update on every git commit
  cartograph help            Show this help

The map lives in .cartograph/ (ARCHITECTURE.md + graph.json) and is committed to git, so your
whole team and any AI assistant share the same, always-current understanding of the project.`;

async function main() {
  switch (cmd) {
    case "init":
      await init(cwd);
      break;
    case "new":
      if (!args[0]) {
        console.error("✗ Name fehlt:  cartograph new <name>");
        process.exit(1);
      }
      await newProject(args[0], cwd);
      break;
    case "build":
      await build(cwd, { quiet: flags.has("--quiet") });
      break;
    case "install-hook":
      console.log(installHook(cwd)
        ? "✓ Auto-Update-Hook aktiv (core.hooksPath → .cartograph/hooks)."
        : "✗ Kein git-Repo gefunden. Erst `git init`, dann erneut versuchen.");
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`✗ Unbekannter Befehl: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗", err?.message || err);
  process.exit(1);
});
