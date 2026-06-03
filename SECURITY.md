# Security Policy

## Supported versions

Cartomap is distributed on npm (`cartomap`) and follows [SemVer](https://semver.org).
Security fixes land on the latest minor release.

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | ✅                 |
| < 0.4   | ❌ (please upgrade) |

## Reporting a vulnerability

Please report security issues **privately** — don't open a public issue for anything exploitable.

- **Preferred:** open a private advisory via the repository's
  [**Security tab → "Report a vulnerability"**](https://github.com/Thepikde/cartomap/security/advisories/new).
- We aim to acknowledge within a few days and to ship a fix or mitigation as quickly as is
  practical, then credit you in the release (unless you'd rather stay anonymous).

## Security posture

Cartomap is intentionally small and runs entirely on your machine. By design:

- **Offline.** It makes **no network requests** — no telemetry, no analytics, no phone-home.
  It runs fine air-gapped.
- **Zero runtime dependencies.** Nothing is fetched from npm at run time, which keeps the
  supply-chain surface minimal.
- **Deterministic & reproducible.** The same code produces the same map — no randomness, no
  timestamps baked into the output.
- **Reads only what it needs.** It scans the source under your configured `roots` plus project
  manifests (`package.json`, `tsconfig.json` / `jsconfig.json`, a Prisma schema if present). It
  writes **only** to `.cartomap/`.
- **It does not run your application code.** The TypeScript analyzer parses files with the official
  TypeScript compiler API (**AST only** — it never executes them); the fallback analyzer is plain
  regex. For deep analysis it may *load* your project's `typescript` package (the compiler), nothing else.
- **Read-only git.** It calls a few read-only `git` commands (e.g. `git ls-files`,
  `git diff --cached`, `git rev-list`) to scope files and detect when the map is behind `origin`.
  The pre-commit hook **never blocks your commit** and never transmits anything.

## What to keep in mind

- `.cartomap/ARCHITECTURE.md` is committed to your repository and describes structure (routes,
  module and model **names**, dependencies). It does **not** read secret *values* (env vars,
  tokens) — only code structure — but treat the map like any other checked-in source document.
- If your repository is private, the generated map is exactly as private as the repository.
