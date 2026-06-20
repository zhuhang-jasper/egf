# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Verification

- Do **not** run lint (`oxlint`, `npm run lint:*`) or build (`vite build`, `npm run build`) as part of completing a task. The user runs these themselves.
- Only run them when explicitly asked.

## Commands

Requires Node >= 24 (`.nvmrc` pins 24). The `prebuild` hook runs `scripts/check-node-version.js` before `dev`/`build` and fails fast on a mismatch.

- `npm run dev` — Vite dev server on port 5174
- `npm run build` — production build (Vite + Rollup) into `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint:check` / `lint:fix` — oxlint
- `npm run format:check` / `format:fix` — oxfmt (config in `.oxfmtrc.json`)
- `npm run bumpver:patch|minor|major` — bump `package.json` version with no git tag (the version bump is what triggers release; see Deploy)

There is no test suite.

## Architecture

A single-page React 19 app (Vite 8, Tailwind v4, Zustand) that renders an interactive 9-pillar engineering-competency radar chart. No backend — all state lives in the browser and `localStorage`.

### Two tabs

`HomePage` ([src/pages/HomePage.jsx](src/pages/HomePage.jsx)) hosts two tabs, both always mounted and toggled via `hidden`:
- **Tool** (`ToolContent` → `ChartSection` + `FormPanel`) — the radar chart and the level-input form.
- **Theory** (`TheoryContent`) — the competency matrix and framework documentation, deep-linkable via URL params (see `src/utils/theory-url.js`). A pillar's help icon in the tool form jumps cross-tab into the matrix (`onOpenPillarInMatrix` / `matrixNav`).

### The pillar / track model — start here

[src/constants/framework.js](src/constants/framework.js) is the source of truth for the domain model:
- `PILLARS` — the master catalog of the 9 pillars (id → label).
- `TRACK_VARIANTS` = `["fe", "be"]` (Frontend / Backend). Each track in `TRACKS` defines its own `pillarOrder` (chart axis order) and `pillarGroups` (cluster membership). Tracks can include a different subset of pillars (e.g. BE omits `uiUx`).
- `CLUSTERS` — Technical / Product / Operational, with colors used across chart, form, and badges.
- `CANONICAL_PILLAR_IDS` — the deduped union of all tracks' pillars; the canonical storage shape.

Two representations of a profile coexist and must be kept in sync:
- **`pillarLevels`** — a `{ pillarId: number }` map. This is **canonical** (track-independent) and is what gets persisted.
- **`levels`** — a positional array ordered to match the *current track's* `pillarOrder`. This is the **view** the chart and form consume.

[src/constants/levels.js](src/constants/levels.js) does the conversions: `syncLevelsArrayFromMap` (canonical → view), `mergeViewIntoCanonical` (view → canonical), `clampLevel`/`formatLevelForInput` (values are 0–5 in `LEVEL_STEP` = 0.5 increments). When changing track or applying a profile, always round-trip through these so the array and map don't drift.

### State (Zustand)

[src/store/useAppStore.js](src/store/useAppStore.js) holds everything: profile data (`title`, `pillarLevels`, `levels`, `trackVariant`), chart display toggles, and saved profiles. Every mutating action ends by calling `persistDraft()`, which writes the working draft to `localStorage` (keys in `src/constants/storage.js`). Saved profiles are a separate list. The `withSyncedLevels` helper re-derives `levels` from `pillarLevels` after any change. Persistence helpers live in `src/utils/storage.js`; storage payloads are normalized via the `levels.js` functions so old/malformed data is tolerated.

### Scoring

[src/constants/scores.js](src/constants/scores.js) computes derived metrics from `levels`; the tunable parameters (weights, thresholds, `CAREER_LEVEL_REQUIREMENTS` for L1–L5) live in [src/constants/scoring.js](src/constants/scoring.js). Career level is the highest band where peak, breadth, and cluster-average floors are all met.

### Chart

Chart.js radar lives under [src/chart/](src/chart/), driven by React hooks in `src/hooks/` (`useCompetencyChart`, `useStaticCompetencyChart`). `instance.js` creates/updates the chart imperatively; `radar-center.js`/`fonts.js` handle fitting the radar into its frame (a multi-pass converge loop); `plugins.js` draws cluster background wedges. `src/utils/copy-chart-image.js` (html2canvas) exports the chart as an image.

### Conventions

- Import alias `@/` → `src/` (configured in `vite.config.js`, `jsconfig.json`, `components.json`).
- JS + JSX only (no TS files despite `typescript` being installed for jsconfig). `components.json` is shadcn-style (new-york, lucide icons); `src/components/ui/` holds the primitives.
- `src/constants/index.js` is the barrel for the constants — prefer importing from `@/constants`.
- App version is injected at build time as `import.meta.env.VITE_APP_VERSION` from `package.json` (see `vite-plugins/resolve-app-version.js`); `generate-meta.plugin.js` writes `dist/meta.json`.
- Production chunk splitting is rule-based in `vite.chunksplit.js` — add a `CHUNK_RULES` entry when adding a vendor dep you want isolated.

### Deploy

Pushing to `master` triggers two GitHub Actions: `pages_deploy.yml` builds with `GITHUB_PAGES=true` (which sets Vite `base` to `/egf/`) and deploys to GitHub Pages, and `main_push_create-tag-release.yml` creates a tag + release **only if `package.json` version increased** vs. the previous tip. So bump the version (`bumpver:*`) to cut a release. PRs run `pr_check-code-quality.yml` (lint/format) and `pr_check_build.yml`.
