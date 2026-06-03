---
description: Set up Cartograph in this project — build the codebase map and enable auto-update
---

Set up [Cartograph](https://github.com/Thepikde/cartograph) in the current project so this AI session
(and future ones) always has an up-to-date map of the codebase.

1. Run `npx cartograph@latest init` in the project root (or `cartograph init` if it's installed globally).
   - This auto-detects the stack, writes `.cartograph/ARCHITECTURE.md` + `memory/`, adds a block to
     `CLAUDE.md`, and installs a pre-commit hook (chaining into Husky/lefthook if present).
2. Read the generated `.cartograph/ARCHITECTURE.md` and give the user a short summary: detected stack,
   number of routes, data models, and any notable hubs or orphaned modules.
3. Remind them the map now refreshes automatically on every commit.

If `npx`/`cartograph` is not available, point the user to the install instructions in the repo README.
