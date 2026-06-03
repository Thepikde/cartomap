# Contributing to Cartograph

Thanks for your interest! Cartograph deliberately stays **small, dependency-free, and deterministic**.

## Dev setup

```bash
git clone https://github.com/Thepikde/cartograph
cd cartograph
npm link        # makes `cartograph` available globally
npm test        # runs the fixture tests (Node's built-in runner)
```

## Principles

- **No runtime dependencies.** The TypeScript compiler is loaded *lazily from the target project*,
  never bundled.
- **Deterministic output** — no timestamps in `graph.json` (keeps git diffs small).
- The generated map is **English by default**; when adding output strings, add them to both `en`
  and `de` in `lib/render.mjs`.

## Adding support for a framework's routes

Route extraction lives in [`lib/routes.mjs`](lib/routes.mjs) and is **regex-based** so it works even
without the TS compiler (light mode). To add one:

1. Write an extractor (e.g. `myFrameworkEndpoints(text)`) returning `[{ method, url }]`.
2. Wire it into `attachRoutes()`.
3. Add a fixture under `test/fixtures/<name>/` and assert it in `test/build.test.mjs`.

## Pull requests

- Keep changes focused; update `CHANGELOG.md`.
- Make sure `npm test` passes (CI runs it on Node 18/20/22).
