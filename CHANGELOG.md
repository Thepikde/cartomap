# Changelog

All notable changes to Cartograph are documented here. Versions follow [SemVer](https://semver.org).

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
