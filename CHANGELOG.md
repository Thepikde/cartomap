# Changelog

All notable changes to Cartomap are documented here. Versions follow [SemVer](https://semver.org).

## 0.4.1
### Fixed
- **Plugin/package version drift** — `.claude-plugin/plugin.json` was stuck at `0.3.1`; it now
  tracks `package.json`, enforced by a new consistency test.
- **`ignore` matching is now path-segment aware** — a user pattern like `"test"` no longer also
  filters `src/contest/…` (was a naive substring). Path fragments (`lib/generated`) and dotted
  filename fragments (`.test.`) still match.
### Changed
- Author/owner name unified to **ThePik** across `package.json`, `plugin.json` and `marketplace.json`.

## 0.4.0
### Added
- **`cartomap affected <file>`** — show which files (transitively) import a file: the *blast radius*
  of a change ("what breaks if I touch this?"). Static-import based and reported as an honest lower
  bound; `--json` for tooling.
- **"Start here" entry points** in the map — derived from `package.json` `bin`/`main`, framework
  roots (Next.js) and conventional `index`/`main`/`app` files — so AI assistants know where to begin reading.
- **Impact hint on hubs** — each hub now shows how many files are transitively affected if it changes.
- **`SECURITY.md`** + a Security section in the README documenting the offline, deterministic,
  zero-dependency, read-only posture.
### Changed
- `graph.json` `schemaVersion` bumped to **2** (adds `entryPoints` and `hubs[].affected`).

## 0.3.0
### Added
- **Route extraction beyond Next.js App Router:**
  - Next.js **Pages Router** (`pages/…`)
  - **NestJS** (`@Controller` + `@Get`/`@Post`/… decorators)
  - **Express / Fastify / Koa** (`app.get(...)`, `router.post(...)`, …)
- **Test suite** with fixture projects (`npm test`, Node's built-in runner — zero deps).
- ORM model usage is now detected in **light mode** too (JS projects using Prisma without `typescript`).

## 0.2.0
### Changed
- **Hooks:** chain into an existing Husky/lefthook/git `pre-commit` hook instead of hijacking
  `core.hooksPath` — your other hooks keep working.
- Generated map output is **English** by default; set `"lang": "de"` in the config for German.
- Scanning uses **`git ls-files`** (respects `.gitignore`, faster) with a non-git fallback.
- `graph.json` is **`.gitignore`d** by default; only `ARCHITECTURE.md` + `memory/` are versioned (small diffs).
### Added
- `jsconfig.json` alias support (+ alias resolution in light mode).
- Flags `--no-hook`, `--verbose`; `config.ignore`; `config.docs` surfaced in the map;
  `schemaVersion` + tool version written into `graph.json`.
### Fixed
- `package.json` `files` referenced a non-existent `templates/` directory.

## 0.1.0
- Initial release: project auto-detection, deep TypeScript analysis, generic adapter for other
  languages, `init`/`new`, and the auto-update pre-commit hook.
