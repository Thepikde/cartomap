---
description: Rebuild the Cartograph map for this project and summarize what changed
---

Refresh the [Cartograph](https://github.com/Thepikde/cartograph) map for the current project.

1. Run `npx cartograph@latest build` (or `cartograph build`) in the project root.
2. Read `.cartograph/ARCHITECTURE.md` and briefly tell the user what the map now shows
   (e.g. new routes, models, or orphaned modules since they last looked).
3. If the build reported a `🔖` watch hint (critical code changed without a `memory/` note), suggest
   recording the decision in `.cartograph/memory/`.
