# 🗺️ Cartograph

> A living, always-current map of your codebase — so AI assistants (and humans) instantly know what's what.

Cartograph generates a compact, **git-tracked map** of your project (routes, data models, hubs,
orphaned modules, dependencies) plus a **memory** for decisions and context. It updates
**automatically on every commit**. Point your AI assistant at it and stop burning tokens
re-explaining your codebase.

---

## Why

Large codebases confuse AI assistants — they guess, hallucinate APIs, and miss cross-cutting
concerns. Cartograph hands them (and new teammates) a **~2–4k-token map** instead of 100k+ tokens of
raw files.

- Set it up **on day one** → the memory grows organically with your project, "perfect from the start".
- Drop it onto an **existing** repo → it captures the current state instantly.

Both are first-class.

## Quickstart

**New project (ideal — memory from day one):**
```bash
cartograph new my-app      # creates the folder + git + Cartograph scaffold
cd my-app
# now build your project as usual (npx create-next-app ., cargo init, …)
# the map grows with every commit
```

**Existing project:**
```bash
cd my-project
cartograph init            # detects your stack, builds the map, installs the auto-update hook
```

That's it. Cartograph writes `.cartograph/` and wires a pre-commit hook so the map stays current —
automatically, on every commit.

## What you get

```
.cartograph/
  ARCHITECTURE.md   # the map: routes, data models, hubs, orphaned modules, top deps
  graph.json        # machine-readable graph
  memory/
    INDEX.md        # decisions, open points, project knowledge (hand-maintained)
    decisions.md
```

Plus a `## Project map` block added to your `CLAUDE.md` / `AGENTS.md` telling the AI to read the map first.

## How it adapts to *your* project

Cartograph auto-detects language, framework, source roots and path aliases, then picks an analyzer:

- **TypeScript / JavaScript → deep analysis** (real TS compiler): resolved imports, exports,
  **routes** (Next.js App **and** Pages Router, NestJS controllers, Express/Fastify/Koa),
  Prisma/Drizzle models, client/server components. `typescript` is loaded from your project if
  present; otherwise a lighter regex pass is used (still works).
- **Everything else → broad structural analysis**: file graph + import heuristics for Python, Go,
  Rust, PHP, Ruby, Java/Kotlin, C/C++, C# + a docs scan.

Everything is config-driven via `cartograph.config.json` (roots, aliases, watched "critical" paths, …).

## Auto-update

A pre-commit hook rebuilds the map on every commit and stages it, so it never goes stale — and it
**never blocks your commit**. It's committed into the repo (`.cartograph/hooks/`), so it's
team-friendly; teammates just run `cartograph install-hook` once per checkout.

**Plays nice with existing setups:** if you already use **Husky**, **lefthook**, or a custom
git hook, Cartograph *hooks into* your existing `pre-commit` instead of replacing it — your other
hooks keep working.

> `graph.json` is `.gitignore`d by default (rebuilt locally); only the human-readable
> `ARCHITECTURE.md` and `memory/` are versioned, keeping diffs small.

## Commands

```
cartograph init [--no-hook]          Set up in the current project (empty or existing)
cartograph new <name>                Create a new project with Cartograph from day one
cartograph build [--quiet] [--verbose]   (Re)build the map (--verbose lists files that failed to parse)
cartograph install-hook              Enable auto-update on every commit
cartograph help
```

The generated map is **English** by default; set `"lang": "de"` in `cartograph.config.json` for German.

## Install

**From source (today):**
```bash
git clone https://github.com/Thepikde/cartograph
cd cartograph && npm link    # makes `cartograph` available globally
```

_(An npm package and a Claude Code plugin are on the roadmap.)_

## Requirements

Node ≥ 18. **Zero runtime dependencies.** For the deepest TypeScript analysis, have `typescript`
available in your project (most TS projects already do).

## Roadmap

- npm package (`npx cartograph …`)
- Claude Code plugin (slash commands + skill)
- More language heuristics, interactive `graph.html`, MCP server for live graph queries

## License

MIT © Nderim Selmanaj
