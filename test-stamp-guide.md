# Testing the framework-version stamp

**One import, no console.** Both inputs the resolver reads (`frameworkVersion` and `savedAt`) live on the
profile and survive import unchanged, so a JSON file reaches every state — including grey.

Manage → Import → `test-profiles-stamp.json`. It appends rather than replacing, and the toast has an Undo.
26 rows, in five groups.

Release windows, from the real bump commits:

| Saved on or after | Version     |
| ----------------- | ----------- |
| Aug 18, 2026      | 4.3         |
| Aug 7, 2026       | 4.2         |
| Jul 27, 2026      | 4.1         |
| Jul 16, 2026      | 3.2         |
| Jul 9, 2026       | 3.1         |
| Jun 21, 2026      | 2.9         |
| Jun 15, 2026      | 2.8         |
| earlier           | none — `v?` |

2.8 is where a version first appeared on the Theory tab; nothing was shown before it. 4.0 and 3.0 never
shipped (the bump went 3.2 → 4.1), so no profile can date to them.

---

## A — unstamped, dated

Seven rows, identical mid-level scores (all 2.0), differing only in `savedAt`.

| Row           | Chip              | Colour                    |
| ------------- | ----------------- | ------------------------- |
| A 4.3         | `v4.3 ✓`          | green                     |
| A 4.2 … A 2.8 | own version + `!` | **amber**, 8 pillars each |

Six amber rows spanning 4.2 down to 2.8, each naming its own era.

## B — when green is actually earned

The same profile at different versions, and the scores that stay clear.

| Row                      | Chip     | Colour    | Why                                       |
| ------------------------ | -------- | --------- | ----------------------------------------- |
| B1 senior, stamped 4.3   | `v4.3 ✓` | green     | rated under the current matrix            |
| B2 senior, dated 4.2     | `v4.2 !` | amber, 7  | 4.3 hardened most of what a senior claims |
| B3 senior, dated 2.8     | `v2.8 !` | amber, 7  | same, from further back                   |
| B4 low scores, dated 2.8 | `v2.8 ✓` | **green** | sits below every band that moved          |
| B5 low scores, dated 4.2 | `v4.2 ✓` | **green** | same                                      |

**B3 vs B4 is the feature.** Both are v2.8 profiles. The senior one flags seven pillars; the low-scoring
one flags none, because a 0.5 in Communication still clears a hardened L1. Age alone does not flag —
the score has to land in a band that actually moved.

## C — grey `v???`

| Row                   | Chip        |
| --------------------- | ----------- |
| C1 · date before v2.8 | `v???` grey |
| C2 · no date at all   | `v???` grey |

No tick or exclamation: the label is already all question marks.

## D — recorded stamps beat dates

All saved _today_, each carrying an explicit stamp.

| Row                     | Chip                                         |
| ----------------------- | -------------------------------------------- |
| D 4.3                   | `v4.3 ✓` green                               |
| D 4.2 / 3.1 / 2.8 / 1.0 | own version + `!` amber                      |
| D 9.9                   | `v9.9 ✓` green — ahead of the newest release |

**The precedence check.** Every row would date to 4.3 from its `savedAt`, so any `v4.3` chip here means
the stamp is being ignored.

## E — per-pillar states, all stamped v4.2

| Row             | Colour | Tinted when loaded |
| --------------- | ------ | ------------------ |
| E1 one pillar   | amber  | 1 — Ownership      |
| E2 mixed pillar | amber  | 1 — UI/UX          |
| E3 all zero     | green  | 0                  |
| E4 all five     | amber  | 7                  |
| E5 badge FE     | amber  | 7                  |
| E6 badge BE     | green  | 0                  |

E5/E6 also check that badge + name + chip + trash fit one row at narrow width.

---

## Then check the form

**Load `A 4.2`** — 8 of 9 pillars tinted amber (everything but AI Leverage). Byline reads
`Rated using Framework v4.2 · Updated Aug 10, 2026 …` plus the amber "Some levels have changed since you
rated this."

**Load `B4`** — no tints, no amber line, despite a v2.8 stamp.

**Load `C1`** — no tints at all, byline reads `Rated using Framework v???`.

**Load `E2`** — only UI/UX tinted; hover it for the "levels either side" tooltip.

## Then the save guard

With `E1` loaded:

1. Save button reads **"Saved" and is disabled** — a flagged profile cannot be cleared by a stray click.
2. Nudge any level → it becomes **"Update"**. Press it.
3. Chip flips to `v4.3 ✓`, the Ownership tint clears, byline updates.
4. Press **Undo** in the toast → `v4.2`, the old level and the tint all come back.

## Then the round-trips

**Export and re-import** (Manage → Export, then import that file). Stamps and dates survive; nothing bumps
to 4.3 in transit.

**Old-format import** — open an export, change `"version": 3` to `2`, delete every `frameworkVersion`
line, re-import. Rows come back unstamped and fall to their `savedAt` date rather than being marked
current.

---

## Cleanup

Delete the `t-*` profiles, or use the import toast's Undo straight after importing.
