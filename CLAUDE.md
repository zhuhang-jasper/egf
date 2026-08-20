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

### The pillar model — start here

[src/constants/framework.js](src/constants/framework.js) is the source of truth for the domain model:

- `PILLARS` — the master catalog of the 9 pillars (id → label).
- `PILLAR_ORDER` — the single chart-axis order. **There is exactly one order for the whole app** and `PILLAR_COUNT` is 9. Reordering is safe (everything keys off pillar id, not position), but check the cluster wedges after: a cluster's pillars need not be contiguous (`technical` already wraps), and `sortClusterArc` in `chart/plugins.js` resolves that into one arc.
- `PILLAR_GROUPS` / `CLUSTERS` — Technical / Product / Operational cluster membership and colors, used across chart, form, and badges.
- `TRACK_BADGE_OPTIONS` — FE/BE/FS is a **purely cosmetic badge** on a profile (`attachedBadge`), not a different pillar set. There are no per-track pillar orders or subsets.

**`pillarLevels`** — a `{ pillarId: number }` map — is the only representation of a profile's scores. It is what gets persisted and what the form and scoring read directly. [src/constants/levels.js](src/constants/levels.js) holds `fillPillarLevels` (defaults missing keys, so adding a pillar is forward-compatible), `clampLevel`/`formatLevelForInput` (values are 0–5 in `LEVEL_STEP` = 0.5 increments), and `pillarLevelsToArray`.

`pillarLevelsToArray` exists only for the **Chart.js boundary**, whose datasets are positional: `useCompetencyChart` memoizes one call to flatten the map into `PILLAR_ORDER` sequence. Do not reintroduce a positional array into store state or storage payloads — an earlier dual-representation (`levels` alongside `pillarLevels`, kept in sync both ways) existed only because tracks once had different pillar sets, and it is gone.

### State (Zustand)

[src/store/useAppStore.js](src/store/useAppStore.js) holds everything: profile data (`title`, `pillarLevels`, `attachedBadge`), chart display toggles, and saved profiles. `setLevel(pillarId, value)` is keyed by pillar id. Every mutating action ends by calling `persistDraft()`, which writes the working draft to `localStorage` (keys in `src/constants/storage.js`). Saved profiles are a separate list. Persistence helpers live in `src/utils/storage.js`; storage payloads are normalized via the `levels.js` functions so old/malformed data is tolerated. A v1→v2 migration maps the legacy `trackVariant` key to `attachedBadge` (see `migrateBadgeKey`) — that is the only place the old key is still read.

### Scoring

[src/constants/scores.js](src/constants/scores.js) computes derived metrics from a `pillarLevels` map; the tunable parameters (weights, thresholds, `CAREER_LEVEL_REQUIREMENTS` for L1–L5) live in [src/constants/scoring.js](src/constants/scoring.js). Career level is the highest band where peak, breadth, and cluster-average floors are all met. `computeAverages` returns `pillarCount` alongside the scores, so callers don't need the array's length.

### Chart

Chart.js radar lives under [src/chart/](src/chart/), driven by React hooks in `src/hooks/` (`useCompetencyChart`, `useStaticCompetencyChart`). `instance.js` creates/updates the chart imperatively; `radar-center.js`/`fonts.js` handle fitting the radar into its frame (a multi-pass converge loop); `plugins.js` draws cluster background wedges. `src/utils/copy-chart-image.js` (html2canvas) exports the chart as an image.

### Conventions

- Import alias `@/` → `src/` (configured in `vite.config.js`, `jsconfig.json`, `components.json`).
- JS + JSX only (no TS files despite `typescript` being installed for jsconfig). `components.json` is shadcn-style (new-york, lucide icons); `src/components/ui/` holds the primitives.
- `src/constants/index.js` is the barrel for the constants — prefer importing from `@/constants`.
- `.oxlintrc.json` is the source of truth for which rules are off; it is strict JSON, so anything that needs a *reason* is noted here. Two worth knowing before re-enabling: `react/refs` fires on the "latest ref" pattern (`fooRef.current = foo` beside its `useRef`) used across the imperative Chart.js hooks and `Modal`/`Tooltip`, where keeping the value out of render is the point rather than the bug; and `react/immutability` + `react/preserve-manual-memoization` come from the React Compiler ruleset, which this app does not run.
- `jsx-a11y/prefer-tag-over-role` is off because every `role` in this app is one with no native tag behind it — `combobox`/`listbox`/`option` are the WAI-ARIA combobox pattern, `role="img"` marks a CSS-drawn dot with no `src`, and `role="dialog"` avoids `<dialog>`'s `showModal()` + ref dance for semantics three attributes already give. The rule fired on all of them and caught nothing real, so it cost a `oxlint-disable-next-line` per correct usage. Other `jsx-a11y` rules stay on.
- App version is injected at build time as `import.meta.env.VITE_APP_VERSION` from `package.json` (see `vite-plugins/resolve-app-version.js`); `generate-meta.plugin.js` writes `dist/meta.json`.
- Production chunk splitting is rule-based in `vite.chunksplit.js` — add a `CHUNK_RULES` entry when adding a vendor dep you want isolated.

### Deploy

Pushing to `master` triggers two GitHub Actions: `pages_deploy.yml` builds with `GITHUB_PAGES=true` (which sets Vite `base` to `/egf/`) and deploys to GitHub Pages, and `main_push_create-tag-release.yml` creates a tag + release **only if `package.json` version increased** vs. the previous tip. So bump the version (`bumpver:*`) to cut a release. PRs run `pr_check-code-quality.yml` (lint/format) and `pr_check_build.yml`.
