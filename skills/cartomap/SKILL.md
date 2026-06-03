---
name: cartomap
description: Use when working in a repository that contains a `.cartomap/` directory. Read `.cartomap/ARCHITECTURE.md` first — before larger code tasks — to understand the project's routes, data models, hubs, and structure without scanning every file, and keep `.cartomap/memory/` decisions current.
---

# Cartomap project map

This repository uses [Cartomap](https://github.com/Thepikde/cartomap): a compact, always-current,
git-tracked map of the codebase. **Use it instead of re-reading the whole project.**

## When this applies
The current project has a `.cartomap/` directory.

## What to do
1. **Read [`.cartomap/ARCHITECTURE.md`](.cartomap/ARCHITECTURE.md) first.** It lists routes, data
   models, hubs (most-imported files), orphaned modules, and the stack — a ~2–4k-token overview
   instead of 100k+ tokens of raw files.
2. For the *why* (decisions, conventions, open points), read `.cartomap/memory/INDEX.md`.
3. The map auto-updates on every commit. If it looks stale, run `cartomap build`.
4. When you make a meaningful decision, add a short note under `.cartomap/memory/` — that is the
   project's living knowledge and is not derivable from code.

## Notes
- The map's top banner warns if the checkout is behind `origin` (possibly stale code).
- `graph.json` is the machine-readable form of the same data, if you need structured lookups.
