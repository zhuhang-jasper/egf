# Profile framework-version stamping

## Context

The competency matrix is periodically rewritten. v4.3 changed 40 of its 45 cells. A user
who rated a profile under v4.2 has no way to know whether the cell they scored against
still means the same thing, so their saved score may be silently stale.

The changelog answers "what changed" at a summary altitude ("40 of 45 cells reworked"),
right for a reader catching up, wrong for a user asking **"is my 4 still a 4?"**. That
question is per-pillar and needs answering where the score lives.

Two earlier designs were considered and rejected:

- **Computed diff viewer** (store old matrix snapshots, diff programmatically). Requires
  every prior revision in the bundle, and a mechanical diff cannot tell a raised bar from
  a copy-edit.
- **Inline `**bold**` change markers + highlighter toggle.** Editorial marking beats a
  computed diff, but it shows _evidence_ of change rather than answering the user's
  question. Superseded by this feature.

**Outcome:** a profile carries the framework version it was rated under. Pillars whose
bar has moved since are flagged, in the profile list and in the form. Scores are never
altered automatically.

## Model

1. **Stamp** — each saved profile records the framework version it was rated against.
2. **Watermark** — per pillar, the newest version where that pillar's _expectations_
   changed (not merely its wording).

Pillar P is stale for a profile when `BAR_MOVED[P]` is newer than the profile's stamp.
Reuse `isNewerVersion` / `changelogRank` from `src/constants/changelog.js`.

**Scores are never auto-changed.** The flag is advisory; the user decides. Saving bumps
the stamp whether or not they edited anything.

Per-pillar staleness does not segment users (every profile rates all 9 pillars). Its
value is scoping the **review task**: "Architecture and UI/UX moved" is a 2-pillar
review, not a 9-pillar one.

## The trigger: levels that got HARDER

Not "this cell changed" and not "this pillar changed". The flag fires for **a level whose
clause set changed enough that someone previously rated there might not clear it now, or
would clear a higher one.**

Two consequences:

- **Direction matters.** A level that got _easier_ or merely _clearer_ invalidates no
  rating — someone rated there still clears it. Only hardening produces a false rating.
  Flagging on any change would fire constantly (40 of 45 cells moved in 4.3) and be
  ignored within one release.
- **Level scope, not pillar scope.** If Architecture hardened only at L1–L2, someone
  rated L4 needs to re-read nothing. With 4.3 shipping stamped (below), every existing
  profile is evaluated on day one, so false positives land immediately — precision is not
  a later refinement.

A profile flags pillar P when P's raise record is newer than the profile's stamp **and**
its score for P falls in the affected band of any hardened level.

**Affected band: a hardened level `n` covers scores `n` through `n + 1` inclusive.**
Levels are cumulative — a 2.0 asserts L1 _and_ L2 — so hardening L1 puts a 2.0 rating
directly in question, not just a 1.5. The band stops one level up because the intervening
levels absorb the change: someone at L4 plainly clears a slightly-harder L1.

That inclusive upper edge is a judgement, not a derivation. It double-covers every whole
number (a 2.0 is caught by a hardened L1 _and_ a hardened L2), which is harmless — the
verdict is boolean per pillar.

## Data: watermark on CHANGELOG entries

Add an optional `barRaised: { pillarId: [levels] }` field to CHANGELOG entries — the
**set** of levels that got harder in that pillar, in that release. It sits beside
`sections`, whose pattern it mirrors: authored per entry, derived into a lookup map.

```js
{
  version: "4.3",
  date: "Aug 19, 2026",
  sections: ["pillars", "matrix"],
  // Levels whose bar got HARDER — not merely reworded, retiered, or clarified. A profile
  // stamped older than this version flags the pillar when its score falls in a hardened
  // level's band (n through n+1 inclusive). Omit a pillar when nothing in it got harder;
  // omit the field entirely when no pillar did.
  barRaised: {          // ← ILLUSTRATIVE shape. The real authored values are in changelog.js.
    uiUx: [1, 2, 3, 4, 5],
    communication: [2, 3],
    architecture: [1, 2],
    coding: [1, 2],
  },
  changes: [ ... ],
}
```

- **Object keyed by pillar id**, so it reads as a sibling of `sections` and derives with
  the same newest-first walk.
- **Sparse by omission.** No key = nothing hardened. "Nothing got harder" is the default
  and the zero-noise case, which matters because clarification-only releases will be the
  common kind.
- **Levels are ints 1–5** on the L-scale — the _level_ that hardened, not a score. Scores
  (0–5 in 0.5 steps) are what get compared against the derived band.

### `barEased` — the mirror field

A release may also make a level _easier_, which invalidates a rating in the opposite
direction: someone who couldn't quite reach L4 might now clear it. Authored the same way,
consumed with the **opposite band**:

```js
barEased: { uiUx: [3] },   // eased level n affects scores [n-1, n]
```

|         | hardened `n`               | eased `n`                    |
| ------- | -------------------------- | ---------------------------- |
| Band    | `[n, n+1]`                 | `[n-1, n]`                   |
| Meaning | may be rating **too high** | may now qualify for **more** |
| Tone    | amber, a warning           | positive, **not** amber      |

Three states per pillar: hardened-only, eased-only, or both.

**The mixed case is a squeeze, not a contradiction.** It means the level _below_ the score
got harder and the level _above_ got easier — both bars moved toward the rating from
opposite sides, so the gap it sits in narrowed and either direction is now plausible.
Rare: it needs one release to move different levels of the _same_ pillar in both
directions.

**Copy — exact wording still to be decided at render time; colour is DECIDED (see below).** The
shape:

| State       | Meaning                | Draft copy                                                    |
| ----------- | ---------------------- | ------------------------------------------------------------- |
| raised only | may be rating too high | "The bar rose here. You may be rating high."                  |
| eased only  | may qualify for more   | "The bar moved. You may now qualify for more."                |
| both        | position less certain  | "Levels either side of your rating changed. Worth a re-read." |

Rejected: naming the specific levels ("L2 got harder, L4 got easier"). The data supports
it, but it makes the reader map level numbers onto their own score — the decoding this
feature exists to spare them.

### Palette: DECIDED — reuse the save button's green/amber

No new palette. Take the two triples straight from `SAVE_STATUS_META`
(`TitleToolbar.jsx:37`), which is already the app's settled-vs-needs-action pair:

| Role                 | Classes                                          |
| -------------------- | ------------------------------------------------ |
| settled (green)      | `border-green-600/40 bg-green-50 text-green-700` |
| needs action (amber) | `border-amber-500/50 bg-amber-50 text-amber-700` |
| unverified (grey)    | `border-slate-300 bg-slate-100 text-slate-600`   |

The grey is a **filled pill, not an outline** — same three-part shape as the other two, so
all three read as one family of chips rather than two chips and an absence. `ChartScores.jsx:75`
(`border-slate-600 bg-slate-50 text-slate-800`) is the existing precedent for a filled slate
pill; this uses `bg-slate-100` over `bg-slate-50` so the fill is unmistakably present next to
the white row background the combobox renders on.

Mapped onto the three per-pillar states, plus the two stamp-resolution states:

| State                                   | Colour       | Icon |
| --------------------------------------- | ------------ | ---- |
| nothing moved                           | green        | tick |
| raised only                             | amber        | `!`  |
| eased only                              | **green**    | tick |
| both (mixed)                            | **amber**    | `!`  |
| unverified / unknown (legacy, no stamp) | grey, filled | `?`  |

**Only two colours plus grey.** That resolves both constraints the earlier draft left
open, and it resolves them the same way:

- **Eased-only is green, not a third colour.** It is good news, and amber would invert the
  pull that makes the flag worth acting on. Green keeps it out of the attention queue while
  the tooltip still carries "you may now qualify for more" for anyone who opens it. A third
  hue would buy a distinction nobody needs at chip altitude.
- **Mixed leans amber.** "May be wrong in some direction" is closer to caution than to good
  news, and it must not borrow the grey used for unverified — grey says _no information_,
  which is the opposite of what mixed means.

The rule collapses to: **amber iff anything is raised.** That is the same rule the chip
roll-up uses (below), so per-pillar and whole-profile resolve through one predicate rather
than two that can drift.

### Surfaces this decision propagates to

The same state model renders in four places, and they do not all carry the same
information. All four take their colours from the one table above:

| Surface                  | Scope         | Notes                                                                                                                                       |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropdown chip, every row | whole profile | Roll-up over 9 pillars. See the aggregation problem below.                                                                                  |
| Active loaded profile    | whole profile | Same state as its dropdown row; needs a home in the toolbar area. Must agree with the row it came from, or the two read as different facts. |
| Per-pillar in-form mark  | one pillar    | Amber-tinted `LevelInput` pre-slider, warning icon beside the label post-slider.                                                            |
| Tooltip copy             | one pillar    | The three strings above.                                                                                                                    |

**The roll-up has a state the per-pillar model does not.** A profile can hold one pillar
raised and another eased — pillar-level "mixed" (both directions on _one_ pillar) is rare,
but profile-level mixed is not, because it only needs two different pillars to move
oppositely. So the chip needs an answer for:

- all clear
- some raised, none eased
- some eased, none raised
- **both present across different pillars** ← the common mixed case, distinct from
  per-pillar mixed

**DECIDED: amber iff anything is raised.** Everything else is green. A possible
over-rating is the more actionable fact, and the eased pillars are still discoverable
in-form after loading. So the four cases collapse to two colours:

| Roll-up case                   | Chip  |
| ------------------------------ | ----- |
| all clear                      | green |
| some raised, none eased        | amber |
| some eased, none raised        | green |
| both, across different pillars | amber |

This is the same predicate as the per-pillar rule, which is why the two cannot disagree.
The active-profile indicator and its dropdown row must resolve identically — same input,
same rule, ideally the same component.

**Two sets, not per-cell labels.** A `{level: "harder"|"easier"|"remain"}` map was
considered and rejected: `remain` is the overwhelming majority (40+ of 45 cells in 4.3
were reworded without moving either bar), so authoring it is pure noise — sparse omission
already means "unchanged". The two bands are consumed differently anyway, and `barEased`
stays purely additive, shippable after `barRaised` without reshaping authored data.

**Easing is the harder editorial call.** "Easier" versus "merely clearer or rescoped" is
genuinely blurry — v4.3's UI/UX L4/L5 rewrite is exactly the ambiguous kind. An over-marked
easing promises an upgrade that isn't there, which burns trust faster than a missed flag.

### Dev guard

**Extend the dev guard** at the bottom of `changelog.js` (which already validates section
ids) to reject:

- unknown pillar ids — a typo silently means "nobody is ever flagged for this pillar",
  invisible, and exactly the failure mode the existing section check was written to catch;
- levels outside 1–5;
- **the same pillar+level appearing in both `barRaised` and `barEased` in one entry** — a
  cell cannot get harder and easier at once, and nothing else prevents it.

**A set, not a ceiling and not a range.** One release can harden L1 and L4 while leaving
L2–L3 alone (`coding: [1, 4]`), and the affected populations are disjoint: 1.0–2.0 and
4.0–5.0. A ceiling would flag everyone below it — the exact over-flagging the direction
rule exists to prevent. A contiguous range cannot express the gap.

**Entries are PER-RELEASE, never cumulative.** Each records only what that release
hardened. The union across releases is computed at read time (below), so re-listing an
earlier release's levels would double-count nothing but would mislead the next author.

### Derivation: union since the stamp, NOT newest-wins

Do **not** pre-collapse into a `{pillar: {version, levels}}` map the way
`SECTION_LATEST_VERSION` collapses `sections`. That pattern is only sound when the payload
is a single value compared for recency; here it is a _set that differs per version_, so
newest-wins silently discards older hardenings.

Concretely, with 4.2 hardening `coding:[4]` and 4.3 hardening `coding:[1]`, a
newest-wins map yields `{version:"4.3", levels:[1]}` — and a profile stamped **4.1** with
a **4.5** score would not flag, despite 4.2 having hardened exactly their level.

Evaluate against the stamp instead:

```js
/** Levels hardened and eased in `pillar` across all releases newer than `stamp`. */
export function movedLevelsSince(pillar, stamp) {
  const raised = new Set();
  const eased = new Set();
  for (const { version, barRaised, barEased } of CHANGELOG) {
    if (!isNewerVersion(version, stamp)) break; // newest-first: everything after is older
    for (const l of barRaised?.[pillar] ?? []) raised.add(l);
    for (const l of barEased?.[pillar] ?? []) eased.add(l);
  }
  return { raised, eased };
}
```

The `break` relies on `CHANGELOG` being newest-first, which the file's authoring rules
already require and `changelogRank` already depends on.

The verdict is then a band test over each union, with the two bands mirrored:

```js
const { raised, eased } = movedLevelsSince(pillar, stamp);
const mayBeHigh = [...raised].some((n) => score >= n && score <= n + 1); // [n, n+1]
// score > 0, not >= : a 0 is "I don't do this at all", not a graded rating. See below.
const mayQualify = score > 0 && [...eased].some((n) => score >= n - 1 && score <= n);
// both true -> neutral "review this pillar"
```

The bands are **asymmetric by design**: hardening looks _up_ from the level, easing looks
_down_. So with L1 moved and a score of 0.5 — hardened L1 (band `[1,2]`) does not flag
(they never claimed L1), while eased L1 (band `[0,1]`) does (they fell short, and the bar
dropped).

**A score of 0 is excluded from eased flags.** `clampLevel` allows `[0, 5]` and
`DEFAULT_PILLAR_LEVEL` is 2, so a 0 was deliberately set and reads as "I don't do this at
all" rather than a graded rating. L1 getting easier does not help someone doing none of
the work, so a may-qualify nudge there is noise. The data cannot distinguish "deliberate
0" from "not applicable", so this is a product call, not a derivation. Hardening needs no
such guard — its bands never reach 0.

**Not** "does the union contain `floor(score)` or `ceil(score)`". That shortcut agrees on
whole numbers — a 4.0 is caught by hardened L3 _or_ L4, since it sits where both bands
meet — but diverges on half-steps: a **4.5** is caught only by a hardened **L4** (band
4.0–5.0), never by L5 (band 5.0–6.0). The band is anchored to the hardened _level_, not
derived from the score.

This is what makes a multi-version jump correct: a profile stamped 4.0 crossing 4.1, 4.2
and 4.3 sees the union of everything each of them hardened, not just the most recent.

The judgement sits beside the bullet explaining it, so the two cannot disagree. Extend
the existing dev-only guard at the bottom of the file to reject unknown pillar ids
(mirrors the `THEORY_SECTIONS` check already there).

**This is an editorial call each release, and the feature's credibility rests on it.**
Marking a level sends every user rated at or below it back to re-read: undermark and
scores go stale, overmark and the signal gets ignored. Not derivable from the diff — the
question is whether a cell got _harder_, which only the author can judge.

**"Neither" is the expected answer, not a fallthrough.** A cell can be rewritten from end
to end and still move no bar. v4.3's L1 pass is the canonical case: seven L1 cells were
rewritten so each opens with what the person can already do rather than a list of
failures — same expectations, different framing. Someone rated L1 under 4.2 is still L1
under 4.3, so there is nothing to re-rate and no entry belongs in either set.

Ask **"would a person rated here still clear it, and would they clear nothing more?"** —
not "did this change much". Rewriting is not evidence of either direction. When judging
40 reworded cells there is real pressure to mark _something_; resist it, or the set
inflates until it means nothing.

**The honest home for a heavy-but-neutral rewrite is the changelog**, which already
carries it in prose. That does invite a re-read for anyone who wants one — the right
altitude for "we rewrote this", since a reframing can change how a user reads themselves
without changing the bar. That shift is real but unflaggable: it is unfalsifiable
per-user, applies to nearly every reworded cell, and the existing rating was a _correct_
reading of an identical bar.

**v4.3 values are DECIDED and already authored** into the v4.3 CHANGELOG entry
(`src/constants/changelog.js`) — 26 raised cells, 2 eased. Cross-checked against the
matrix diff: every marked cell has real text changes, and no pillar+level appears in both
sets. The 12 changed-but-unmarked cells (Coding L1/L4/L5, Domain Logic L4, Architecture
L4, AI L4, Product Sense L5, Process L1/L5, Communication L5, Ownership L2/L3) are the
neutral rewrites.

**Launch impact, computed from those values.** Per pillar, the share of the 11 possible
scores (0–5 in 0.5 steps) that flag for a pre-4.3 profile:

| Pillar       | Flags | Pillar                               | Flags |
| ------------ | ----- | ------------------------------------ | ----- |
| AI Leverage  | 3/11  | Ownership                            | 6/11  |
| Domain Logic | 4/11  | Process                              | 7/11  |
| Coding       | 5/11  | Architecture · Product Sense · UI/UX | 8/11  |
|              |       | Communication                        | 9/11  |

Every pillar flags _some_ scores, so **essentially every v4.2 profile will show attention
on load**. That is the honest reading of a release that raised 26 bars.

**DECIDED: ship at 4.3 anyway.** The deferral option (hold the mechanism to 4.4 so it
launches quiet) was considered and rejected. A release that raised 26 bars is exactly the
release where the flag earns its keep — going quiet would mean the one time the signal
matters most is the one time it stays silent, and every 4.2 profile would carry a
now-permanently-unflagged staleness.

Amber being the norm at launch is therefore accepted, with one thing making it defensible:
**the flag is per-pillar and score-scoped, so a profile is only flagged where its own
rating actually sits in a moved band.** A profile whose scores miss every hardened band
stays green even though it is stamped 4.2 — the per-pillar watermark is what keeps "mostly
flagged" from becoming "everyone flagged for everything". Nothing here softens the data.

Superseded initial read (pillar-level, pre-dating the harder/easier trigger): UI/UX
throughout, Communication around L2–L3, Architecture around L1–L2, with Coding because
Framework Proficiency moved into it. Treat as a starting point for the pass, not an
answer — in particular, a pillar whose cells were _clarified_ rather than _hardened_
should carry no entry at all.

## Storage: stamping the version onto each profile

**No `createdAt` — DECIDED, not deferred.** `savedAt` is rewritten by every `writeProfile`, so it is a
last-modified time and the original write time of existing profiles is already gone; the only available
backfill (`createdAt = savedAt`) would assert a creation date that is really a modification date. Beyond
the missing data, it answers neither question this byline exists for: a profile created under v4.1 and
updated yesterday is a v4.3 rating, and it is the _update_ that establishes that. The byline says
"Updated", which is the only claim the data supports.

Per-profile shape is an **allow-list rebuild** — `normalizeStoredProfile`
(`src/constants/levels.js:116`) returns exactly `{id, title, pillarLevels,
attachedBadge, savedAt}` and silently strips anything else. So the field must be added
there or it vanishes on every load.

Recommended (cheapest correct) variant — stamp is a saved-row field, backfilled lazily:

1. `src/constants/levels.js` — `normalizeStoredProfile`: add `frameworkVersion`, with a
   fallback for rows predating it (see _Legacy_ below).
2. `src/store/useAppStore.js` — `writeProfile`'s `row` literal (~line 589): stamp
   `FRAMEWORK_VERSION` on save. This is the single choke point for all profile writes.
3. `src/utils/profile-transfer.js` — add to `toExportPayload`'s row mapping, bump
   `EXPORT_VERSION` to 3, add `MIGRATIONS[2]` backfilling the stamp. The chain walker
   already supports this cleanly (unlike the storage migration).

Do **not** bump `SCHEMA_VERSION`. Its gate `isPreV2` is a boolean `>=` test, not a
version walk, so bumping it would re-run `migrateBadgeKey` over every v2 payload
(harmless but wrong). Rows heal lazily on next write instead.

The stamp is a saved-row attribute, not a draft field, so `toDraftStoragePayload` and
`applyState` need no change — unless the in-form flags must survive a reload without a
load, in which case `applyState` also needs a line.

## Unparseable (pre-v1) rows

A row `normalizeStoredProfile` cannot parse — no object `pillarLevels`, e.g. the
pre-`pillarLevels` positional `levels` shape CLAUDE.md says is gone — already returns
`null` and is skipped by `loadProfilesFromStorage`. It is invisible in the UI today.

**Drop it rather than preserving it.** A rating made against a pre-v1 matrix is precisely
what this feature exists to declare invalid, so carrying it forward would be incoherent.

**This already happens at the migration, on app load — no new code.**
`loadProfilesFromStorage` rewrites storage during load whenever `needsMigration` is true,
and rejected rows are simply absent from `out`:

```js
const needsMigration = isPreV2(parsed);
for (const row of arr) {
  const n = normalizeStoredProfile(needsMigration ? migrateBadgeKey(row) : row);
  if (n) out.push(n); // ← null rows dropped here
}
if (needsMigration) writeProfilesToStorage(out); // ← written away on load
```

So the discard lands exactly at the migration moment. (On an already-current payload
`needsMigration` is false and no rewrite occurs, so a stale row would linger — but such a
row surviving a payload that already migrated past v1 would be anomalous, and it is inert
either way.)

The only addition worth making: a `console.warn` in `normalizeStoredProfile`'s reject path
gated on `import.meta.env.DEV`, matching the dev-guard pattern at the bottom of
`changelog.js`. One line, and it fires _before_ the rewrite — so if these rows exist
anywhere, the shape gets logged as it is discarded rather than vanishing unrecorded. The
pre-v1 schema cannot be reconstructed from code (verified: no migration for it survives).

## Legacy profiles (no stamp)

Derive a prior from `THEORY_SEEN_SECTIONS_KEY`'s **`matrix`** entry. One source, no
era-specific branching:

```
seenSections.matrix  ??  unknown
```

**Every user who has ever loaded the app has this map.** `useTheoryUpdates` is called
unconditionally from `HomePage` (`HomePage.jsx:239`) — the app's only page, with both
tabs always mounted — and `readSeenSections` (`useTheoryUpdates.js:143`) writes the map
back on first mount. Opening the Theory tab is not required; the bottom-nav badge needs
the aggregate on either tab. So there is no path to having saved a profile without a map.

Its value is `FRAMEWORK_VERSION` **as of that user's first load**, so someone who arrived
during 4.2 holds `matrix: "4.2"`. Users predating the map carry their old
`THEORY_SEEN_VERSION_KEY` value, which the migration copies into every section before
deleting the key — so the legacy key needs no separate read.

Accuracy: the hook's own comment notes the value means "last opened at", read as "read
at". Someone who first loaded at 4.2 and saved at 4.3 without revisiting Theory reads as
4.2 — biased **toward** flagging, the safe direction for a re-rating prompt.

- **Derived** — grey/unverified, not green. Honest grounds: it is an _inferred_ value,
  not a recorded one. (Not because it is likely wrong — per the above it usually is not.)
- **No map at all** — unknown, grey, question mark. Rare, but handle it rather than
  defaulting to current.
- Treat unknown and derived alike as **"unverified", never "stale"**. Flagging every
  legacy profile amber on first launch would be a bad first impression of a trust feature.
- Every save replaces the inferred prior with a recorded stamp, so this self-heals.

Note `changelogRank` already returns `Infinity` for versions absent from CHANGELOG
(which starts at 3.0), so pre-3.0 stamps read as ancient without special handling.

## UI

### Profile list chip — `src/components/ProfileCombobox.jsx`

A version marker per option row: **version text + color + icon**. Necessarily a
whole-profile roll-up (one chip can only say "something moved"); detail lives in the form.

Slot: inside the load button, after `<ScrollingLabel>`, `shrink-0` with `ml-2`. The
popover is `w-max min-w-full max-w-[calc(100vw-2rem)]`, so it widens to fit rather than
crushing the name, and `ScrollingLabel` already marquees when squeezed.

Base it on `TrackBadge` (`src/components/TrackBadge.jsx`) — the canonical pill, already
in that row's `w-14` slot, with `em`-based dimensions. Use `TOOL_TEXT.label` from
`src/styles/control-typography.js` ("text ABOUT something else: a badge"). **No new
typography rungs** — the file forbids it.

States and classes: see _Palette: DECIDED_ above — green tick / amber `!` / filled-grey `?`,
all three the same filled-pill shape. Do not restate the class triples here; one table owns
them.

An older version still shows **green + tick** when nothing relevant moved — that is the
point of per-pillar watermarks. No red anywhere.

**Every row, not just the active profile.** The flag is meant to be seen upfront, before
a profile is opened — the chip answers "which of my profiles need attention", and loading
one then reveals which pillars.

### Rollout: 4.3 ships stamped

The feature launches with 4.3's `barRaised` populated, so every v4.2 profile is evaluated
on first load and flags on the pillars that hardened. This is intended, not a side effect,
and it is why the harder/easier trigger and level scoping matter on day one rather than as
later precision work. See _Launch impact_ above for the accepted cost.

### In-form flag — `src/components/PillarCluster.jsx`

Amber warning icon + `Tooltip` on the affected pillar. Reuse `Tooltip`
(`src/components/ui/Tooltip.jsx`) exactly as the help button does at `PillarCluster.jsx:88`
— parent gets `group relative`, `Tooltip` is a child. For wrapping text follow
`ChartScores.jsx:41`'s `className="w-[12rem] whitespace-normal ..."`.

**Placement depends on a pending change.** The user intends to replace `LevelInput` with
a slider under the pillar label, making the row two-line and freeing horizontal space.

- **Before the slider (interim): amber-tint the `LevelInput` itself.** No new element, so
  no width cost — which matters because `PillarLabel` has only ~27px of slack at the
  narrowest breakpoint and the doc comment at `PillarCluster.jsx:14` warns the longest
  label ("🗣️ Communication (Voice)") already "fits, but only just". Reuse the
  `amber-500/50` border + `amber-50` bg + `amber-700` text triple from `SAVE_STATUS_META`.
  Tinting the control also puts the mark on _the number that may be wrong_, which reads
  more directly than a marker beside the name.
- **After the slider lands:** warning icon inside `PillarLabel`, right after the name;
  the help icon ("view in matrix") moves to the row's far right.

Either way the `Tooltip` carries the explanation. Note the interim tint needs a
non-colour affordance too (icon or `aria`), since colour alone is not an accessible
signal — the `LevelInput`'s `ariaLabel` is the natural place.

No status bar above the form, and no upfront modal — most bumps are no-ops.

### Bump

On save, via `writeProfile`. No separate confirm step.

## Suggested order

1. `barMoved` field + derived map + dev guard (data only, no UI).
2. The v4.3 editorial pass deciding which pillars moved.
3. The **resolver** as a pure, alias-free module with the version list injected, plus
   `scripts/verify-profile-stamp.mjs` and its fixture table. Written before the storage
   change, so the legacy cross-product is pinned before anything reads it.
4. Storage stamp + export migration.
5. Combobox chip.
6. In-form icon — after the slider change, or interim slot if sooner.

Steps 1, 3 and 4 are independently shippable and inert until the UI lands.

## Verification

### Automated: `scripts/verify-profile-stamp.mjs`

The pre-mark resolver is pure (stored row + seen map + legacy key → stamp or unknown), so
it needs no DOM or browser. Follow the existing standalone-script pattern —
`scripts/verify-poster-export.mjs` and `verify-scroll-behavior.mjs` are documented `.mjs`
files run directly by node, exiting 0 on pass and 1 on failure. There is no test runner or
test dependency in this repo and this should not add one.

**Prerequisite for testability — `changelog.js` is NOT importable from plain node today.**
Verified: it imports `@/utils/theory-url` on line 1 (node cannot resolve the alias) and
reads `import.meta.env.DEV` at line 226 (`import.meta.env` is undefined under node, so the
property access throws at import time). Both must be handled. Options, cheapest first:

1. **Run the script through Vite's module runner** rather than bare node, so the alias and
   `import.meta.env` both resolve as they do in the app. Keeps one source of truth for the
   comparator. Costs a Vite dependency in the script's startup path.
2. **Put the resolver in its own alias-free, env-free module** (e.g.
   `src/utils/profile-stamp.js`) importing nothing but plain relative paths, and have the
   script import just that. Requires the version comparator to be reachable without
   `changelog.js` — either move `parseVersion`/`changelogRank` into that module, or pass
   the ranked version list in as a parameter (which also makes the fixture table able to
   stub its own CHANGELOG, a real testing win).
3. **Inline a copy of the comparator in the script.** Cheapest to write, but a second
   implementation that can silently drift from the real one. Avoid.

Option 2 is recommended: injecting the version list makes the resolver a pure function of
its inputs, which is what makes the fixture table below expressible at all.

Assert a fixture table covering the full legacy cross-product:

| Stored profile                                      | Seen map        | Legacy key | Expect                                                            |
| --------------------------------------------------- | --------------- | ---------- | ----------------------------------------------------------------- |
| v1 row (`trackVariant`, no stamp)                   | `matrix: "4.0"` | absent     | derived **4.0**, unverified                                       |
| v1 row                                              | `matrix: "4.1"` | absent     | derived **4.1**, unverified                                       |
| v1 row                                              | absent          | `"4.1"`    | derived **4.1** (migration seeds map from legacy)                 |
| v2 row (`attachedBadge`, no stamp)                  | `matrix: "4.2"` | absent     | derived **4.2**, unverified                                       |
| v2 row                                              | absent          | absent     | **unknown** — never "current"                                     |
| v2 row                                              | `matrix: "2.9"` | absent     | **unknown** (below CHANGELOG floor; `changelogRank` → `Infinity`) |
| v2 row                                              | `matrix: "3.2"` | absent     | derived **3.2**, unverified                                       |
| stamped row (`frameworkVersion: "4.3"`)             | any             | any        | **4.3 recorded** — stamp always wins over any prior               |
| stamped row `"4.2"`                                 | `matrix: "4.3"` | any        | **4.2** — the map must NOT override a recorded stamp              |
| malformed (`frameworkVersion: 42` / `null` / `"x"`) | any             | any        | **unknown**, no throw                                             |

Two assertions that are easy to get wrong and are the reason this test exists:

1. **A recorded stamp always beats a derived prior.** The last two rows guard the
   precedence order; inverting it would silently re-flag correctly-stamped profiles.
2. **Absent everything ⇒ unknown, never `FRAMEWORK_VERSION`.** Defaulting to current
   would mark every legacy profile green and silently assert validity we cannot claim.

Assert the **staleness** verdict separately from stamp resolution, against a stubbed
`PILLAR_BAR_RAISED`. This is where the level scoping and the direction rule get pinned:

| Stamp   | `barRaised` stub                        | Score          | Expect                                                     |
| ------- | --------------------------------------- | -------------- | ---------------------------------------------------------- |
| 4.2     | `architecture: {v:"4.3", levels:[1]}`   | arch **1.0**   | flag                                                       |
| 4.2     | same                                    | arch **1.5**   | flag                                                       |
| 4.2     | same                                    | arch **2.0**   | flag — band is `n`…`n+1` **inclusive**                     |
| 4.2     | same                                    | arch **2.5**   | **no flag** — past the band                                |
| 4.2     | same                                    | arch **4.0**   | no flag                                                    |
| 4.2     | `coding: {v:"4.3", levels:[1,4]}`       | coding **3.0** | **no flag** — the L2–L3 gap                                |
| 4.2     | same                                    | coding **4.5** | flag — upper island                                        |
| 4.2     | same                                    | coding **5.0** | flag — `4`…`5` inclusive                                   |
| 4.2     | same                                    | coding **1.5** | flag — lower island                                        |
| 4.3     | `architecture: {v:"4.3", levels:[1]}`   | arch 1.0       | no flag — stamp not older than the raise                   |
| 4.2     | `{}` (clarified only, nothing hardened) | any            | **no flag anywhere**                                       |
| 4.1     | `uiUx: {v:"4.2", levels:[5]}`           | uiUx 5.0       | flag — a raise from an _intermediate_ version still counts |
| unknown | any                                     | any            | unverified, not flagged as stale                           |

**Multi-version jump** — stub two releases hardening _different_ levels of one pillar:
4.2 → `coding:[4]`, 4.3 → `coding:[1]`.

| Stamp | Score          | Expect                                                           |
| ----- | -------------- | ---------------------------------------------------------------- |
| 4.1   | coding **4.5** | **flag** — 4.2 hardened L4; a newest-wins derivation misses this |
| 4.1   | coding **1.5** | flag — 4.3 hardened L1                                           |
| 4.1   | coding **3.0** | no flag — neither band covers it                                 |
| 4.2   | coding **4.5** | **no flag** — 4.2 is not newer than the stamp                    |
| 4.2   | coding **1.5** | flag — only 4.3 counts from here                                 |

The `4.1 / 4.5 → flag` row is the canary for the union derivation. It passes trivially
under newest-wins if the two stubbed releases harden the _same_ levels, so the stub must
use different ones or the test proves nothing.

**Half-step band anchoring** — the case where a `floor`/`ceil` shortcut silently
over-flags. Stub `coding: {v:"4.3", levels:[5]}`, stamp 4.2:

| Score   | Expect      | Why                                                       |
| ------- | ----------- | --------------------------------------------------------- |
| **4.5** | **no flag** | L5's band is 5.0–6.0. `ceil(4.5) = 5` would wrongly flag. |
| 5.0     | flag        | in L5's band                                              |
| 4.0     | no flag     |                                                           |

Pair it with `levels:[4]`, stamp 4.2: **4.5 → flag** (band 4.0–5.0). The same score
flagging under `[4]` but not under `[5]` is what proves the band is anchored to the
hardened level rather than computed from the score.

**DEFERRED TO 4.4 — eased-only is unreachable in the app at 4.3.** Both eased levels v4.3 authored
(domainLogic L2, uiUx L2) sit inside a raised band of the same pillar, so every real score there
resolves to _mixed_, never _eased_. No fixture profile can exercise the green-eased chip or its byline
copy, and `test-profiles-stamp.json` therefore does not try.

The logic is covered by stubs below (per-pillar and roll-up), so this is an untested _rendering_, not
untested behaviour. To close it when a release eases a pillar it does not also harden: add that entry
to `CHANGELOG` (the dev guard permits it — it only rejects a pillar+level in both sets), then add a
fixture profile scoring inside the eased band. Until then the path ships unseen, which is acceptable
because nothing can reach it.

**Eased band is the mirror, not a copy.** Stub `barEased: { coding: [4] }`, stamp 4.2 —
band `[3, 4]`:

| Score | Expect                                                               |
| ----- | -------------------------------------------------------------------- |
| 3.0   | may-qualify                                                          |
| 3.5   | may-qualify                                                          |
| 4.0   | may-qualify                                                          |
| 4.5   | **no flag** — above the eased level; `barRaised:[4]` would flag this |
| 2.5   | no flag                                                              |

The 4.5 row is the canary: the same `[4]` set flags a 4.5 under `barRaised` and not under
`barEased`. If both bands are implemented identically, this is the row that catches it.

**Bottom of scale** — stub level `[1]`, stamp 4.2, covering the asymmetry and the zero
guard:

| Score | `barRaised:[1]`             | `barEased:[1]`                         |
| ----- | --------------------------- | -------------------------------------- |
| 0.0   | no flag                     | **no flag** — zero guard, not the band |
| 0.5   | **no flag** — below `[1,2]` | **flag** — inside `[0,1]`              |
| 1.0   | flag                        | flag                                   |
| 2.0   | flag                        | no flag                                |
| 2.5   | no flag                     | no flag                                |

The `0.5` row proves the bands run in opposite directions; the `0.0` row proves the zero
guard applies to eased only. Both fail if `mayQualify` is written as a mirror of
`mayBeHigh` without the `score > 0` term.

**Mixed state** — `barRaised: {coding:[2]}` and `barEased: {coding:[4]}`, stamp 4.2, score
**3.0**: both bands match (2→[2,3], 4→[3,4]), expect the neutral "review" state, not two
competing flags. Assert an eased-only pillar does **not** produce the amber/warning state.

Four rows carry the whole design and should be treated as regression canaries:

- **`coding 3.0 → no flag`** — the gap. Proves `levels` is a set, not a ceiling or range.
- **`arch 2.0 → flag` vs `2.5 → no flag`** — the inclusive upper edge, exactly at its
  boundary.
- **`{} → no flag`** — direction. A release that only clarified must flag nobody.
- **`arch 4.0 → no flag`** — level scoping.

If any regress, the feature reverts to flagging everyone on every release — the failure
mode that makes the signal ignorable.

### Manual, with `npm run dev` (user runs it):

- **Fresh profile** — save, confirm the chip reads current/green.
- **Simulated stale** — in devtools, edit a saved row's `frameworkVersion` to `"4.2"` in
  `localStorage["fe-growth-framework:profiles:v1"]`, reload. With `barMoved` set for a
  pillar in the 4.3 entry, that profile's chip should go amber and only that pillar
  should flag in the form.
- **Older-but-valid** — set a stamp to `"4.2"` with no `barMoved` pillars above it;
  chip must stay green with a tick, still reading "v4.2".
- **Legacy unstamped** — delete the field from a row; confirm grey/unverified, not amber,
  and that `THEORY_SEEN_SECTIONS_KEY`'s `matrix` value is used as the prior. Then clear
  that key too and confirm it falls through to unknown rather than defaulting to current.
- **Prior is inferred, not recorded** — set `matrix` to `"4.2"` on an unstamped profile;
  the chip should read v4.2 in grey (unverified), never green, and flip to a recorded
  stamp on the next save.
- **Pre-v3 stamp** — set `"2.9"`; confirm it reads unknown rather than crashing
  (`changelogRank` → `Infinity`).
- **Round-trip** — export profiles, re-import, confirm the stamp survives; also import an
  _old_ export file (v2, no stamp) and confirm `MIGRATIONS[2]` backfills it.
- **Bump** — load a stale profile, save, confirm chip returns to green and the in-form
  icon clears.
- Check the combobox at narrow width (chip must not crush the name) and with long
  profile names (marquee still works).
