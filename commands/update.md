---
description: Rebuild the Cartomap map for this project and summarize what changed
---

Refresh the [Cartomap](https://github.com/Thepikde/cartomap) map for the current project.

1. Run `npx cartomap@latest build` (or `cartomap build`) in the project root.
2. Read `.cartomap/ARCHITECTURE.md` and briefly tell the user what the map now shows
   (e.g. new routes, models, or orphaned modules since they last looked).
3. If the build reported a `🔖` watch hint (critical code changed without a `memory/` note), suggest
   recording the decision in `.cartomap/memory/`.
