#!/usr/bin/env node
// Cartomap CLI — a living project memory for AI coding.
//   cartomap init [--no-hook]   set up Cartomap in the current project (empty or existing)
//   cartomap new <name>         create a new project with Cartomap from day one
//   cartomap build [--quiet] [--verbose]   (re)build the map
//   cartomap affected <file>    show what depends on a file (blast radius of a change)
//   cartomap install-hook       enable auto-update on every commit
//   cartomap help

import { init, newProject } from "../lib/init.mjs";
import { build } from "../lib/build.mjs";
import { installHook } from "../lib/hook.mjs";
import { affected } from "../lib/affected.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const args = argv.slice(1).filter((a) => !a.startsWith("--"));
const cwd = process.cwd();

const HELP = `🗺️  Cartomap — a living, always-current map of your codebase for AI coding.

Usage:
  cartomap init [--no-hook]   Set up Cartomap here (works in an empty OR existing project)
  cartomap new <name>         Create a new project with Cartomap from day one
  cartomap build [--quiet]    (Re)build the map into .cartomap/   (--verbose lists parse errors)
  cartomap affected <file>    Show what depends on a file — the blast radius of changing it (--json)
  cartomap install-hook       Enable auto-update on every git commit
  cartomap help               Show this help

The map lives in .cartomap/ (ARCHITECTURE.md) and is committed to git, so your whole team and any
AI assistant share the same, always-current understanding of the project. Set lang to "de" in
cartomap.config.json for a German map.`;

function reportHook(r) {
  if (!r.ok) return console.log("✗ No git repo found. Run `git init` first, then try again.");
  if (r.mode === "chained") return console.log(`✓ Hooked into your existing ${r.into} pre-commit hook (your other hooks keep working).`);
  return console.log("✓ Auto-update hook installed (core.hooksPath → .cartomap/hooks).");
}

async function main() {
  switch (cmd) {
    case "init":
      await init(cwd, { withHook: !flags.has("--no-hook") });
      break;
    case "new":
      if (!args[0]) {
        console.error("✗ Missing name:  cartomap new <name>");
        process.exit(1);
      }
      await newProject(args[0], cwd);
      break;
    case "build":
      await build(cwd, { quiet: flags.has("--quiet"), verbose: flags.has("--verbose") });
      break;
    case "affected":
      if (!args[0]) {
        console.error("✗ Missing file:  cartomap affected <path>");
        process.exit(1);
      }
      await affected(cwd, args[0], { json: flags.has("--json") });
      break;
    case "install-hook":
      reportHook(installHook(cwd));
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`✗ Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗", err?.message || err);
  process.exit(1);
});
