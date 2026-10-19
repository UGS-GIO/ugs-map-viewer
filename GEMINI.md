# ugs-map-viewer — PR review guide

React + TypeScript + Vite + MapLibre GL — a **public**, STAC-driven map viewer. Review the changed
lines against these repo-specific rules; the general bug / security / performance / quality pass is
assumed. Cite `file:line`, focus on changed lines (use repo context for correctness), skip
unrelated pre-existing issues, and group minor nits.

## MapLibre — the ones that bite here
- **Never mutate the map imperatively from UI/event handlers.** Drive map state from the store /
  derived state and let one sync-and-reconcile layer apply it. Scattered
  `addLayer` / `setPaintProperty` / `removeLayer` inside components is the core smell — flag it.
- Add sources/layers **idempotently** and **tear them down on unmount** — no leaked layers,
  sources, popups, markers, or event listeners.
- A **layer-order change must actually reorder** (imperative `moveLayer` / a correct `beforeId`); a
  React re-render alone is a no-op. (This repo has shipped that bug — watch for it.)
- Update source data with `setData`, not remove-then-re-add. Coordinates are `[lng, lat]`.
- Honor layer `minzoom`/`maxzoom` and visible zoom ranges. Any **new tile / style / sprite host**
  must go through the allowlist/config, not be hardcoded ad hoc.
- Sanity-check paint/layout expressions and `feature-state` usage.

## React / TypeScript
- Effects are for **external systems only** — prefer derived state and TanStack
  Query / Router / Table over ad-hoc `useState`/`useEffect`. Flag effect-driven data flow that
  should be derived.
- Rules-of-hooks; stable, exhaustive deps; avoid needless re-renders and unstable refs/keys.
- No `any`, unsafe casts, or non-null `!` that defeat the types. Prefer discriminated unions.
- Handle loading / error / empty states and **fail loud** on fetch/STAC errors — never
  swallow-and-continue.

## Security & accessibility (public app)
- **No secrets in the client bundle.**
- **Never inject untrusted feature/property values into the DOM** — no `dangerouslySetInnerHTML`
  or unescaped popup HTML built from feature properties.
- Flag accessibility regressions (missing labels/roles/keyboard, insufficient contrast); treat a
  **critical or serious** a11y issue as a blocker.

## Review scope & severity
- Skip (don't post findings): `src/routeTree.gen.ts` (TanStack Router generated) and
  `package-lock.json`; `dist/` build output is gitignored, not committed.
- Blocking here (not a nit): merge to `develop` auto-deploys to the dev Firebase site and rides the
  `develop`→`master` release PR to prod (both run `npm run build`), so a build break or functional
  regression is blocking — as is a client-bundle secret, feature-data DOM injection, or a
  critical/serious a11y regression on this public app.
