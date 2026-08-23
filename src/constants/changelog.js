import { PILLARS } from "@/constants/framework";
import { THEORY_SECTIONS } from "@/utils/theory-url";

// Theory-tab changelog, surfaced by ChangelogModal, which renders the array top to bottom.
//
// Fields:
//   version  — display string, shown as `v{version}`.
//   date     — free-form release date, rendered as-is.
//   changes  — plain-text bullets. `**bold**` is NOT parsed here.
//   sections — THEORY_SECTIONS ids the entry touched, driving the per-section unseen dots (see
//              useTheoryUpdates). Omit to raise no dot. Validated at module load in dev.
//
// Authoring rules:
//   - Newest entry first. Summarise which sections changed, not every detail.
//   - Covers the THEORY TAB, not the source PDF. A bullet earns its place only if a reader can open the
//     tab and see what it describes, so skip PDF entries for material that never shipped here.
//   - Refer to sections by NAME, never by roman numeral: numerals go stale on any reorder.
//   - Entries are historical records. Use the name a section carried AT THAT VERSION, and do not retitle
//     past entries when something is renamed.
//   - Keep `sections` in sync with the bullets: a bullet naming a section missing from it gets no dot.
//   - Name the section where the change RENDERS, not the concept it belongs to. These come apart, e.g. a
//     skill-tier change that draws on the Matrix pillar cards is a Matrix bullet.
//   - One section prefix per bullet. Split "Pillars and Competency Matrix: ..." into two, and tag every
//     section explicitly even for a bullet covering all of them.
//   - Style: section name, colon, plain sentences. No em dashes and no semicolons; split into two
//     sentences instead.
//   - Work in progress goes in CHANGELOG_DRAFT below, not in this array. Same bullet style, no `date` and
//     no `sections` until it ships.
/**
 * THE UNPUBLISHED ENTRY: work in progress, shown at the top of ChangelogModal behind a Draft badge and
 * deliberately NOT part of {@link CHANGELOG}.
 *
 * Kept as its own export rather than a `draft: true` flag on CHANGELOG[0] because four separate things read
 * "the newest entry" and every one of them must ignore a draft: {@link FRAMEWORK_VERSION} (the version
 * printed on the tab), {@link SECTION_LATEST_VERSION} (which raises the per-section unseen dots),
 * {@link changelogRank}'s ordering, and the build-time regex in vite-plugins/resolve-framework-version.js
 * that publishes `frameworkVersion` to dist/meta.json. A flag means remembering to filter in all four; a
 * separate binding means none of them can see it in the first place.
 *
 * `sections` is intentionally absent — the field only feeds the dots, and a draft must not raise any.
 *
 * TO PUBLISH: add `date`, add `sections`, move the object into CHANGELOG's first slot, and set this to null.
 * That one move is what bumps the framework version.
 */
export const CHANGELOG_DRAFT = null;

export const CHANGELOG = [
  {
    version: "4.3",
    date: "Aug 20, 2026",
    sections: ["pillars", "matrix"],
    // Levels whose bar actually MOVED, judged per cell. Not "was this rewritten" — 40 of the 45
    // cells were reworked, and most kept the same bar (the L1 reframing pass is the clearest case:
    // same expectations, opened with what the person can already do instead of a list of failures).
    // `barRaised` = someone rated there may no longer clear it. `barEased` = they may now clear more.
    // Omit a pillar when nothing in it moved; omit the field when no pillar did.
    barRaised: {
      coding: [2, 3],
      domainLogic: [1, 5],
      architecture: [1, 2, 3, 5],
      ai: [3],
      uiUx: [1, 3, 4, 5],
      productSense: [1, 3, 4],
      process: [2, 3, 4],
      communication: [1, 2, 3, 4],
      ownership: [1, 4, 5],
    },
    barEased: {
      domainLogic: [2],
      uiUx: [2],
    },
    changes: [
      "Pillars: added Delivery Sequencing (Process) and Delegation (Ownership).",
      "Pillars: Communication Clarity is now Proactive Updates, Technical Documentation is now Documentation, Build Tooling is now Toolchain Design, Component Reuse is now Component Design, BAU Domain Fluency is now BAU Knowledge.",
      "Pillars: Commitment Accountability and Presentation & Speaking Up each split into two focus areas. Framework Proficiency moved from Architecture to Coding.",
      "Competency Matrix: Stakeholder Reporting, Data Modeling, Component Design, Perceived Performance, User Empathy, Design System Alignment, and Accessibility moved to a different skill tier.",
      "Competency Matrix: 40 of the 45 cells reworked, across all nine pillars. Cells now describe the outcome rather than the method, so a named tactic is no longer the passing answer. UI/UX is the heaviest rewrite, pulling L4 and L5 back to what a frontend engineer owns.",
      "Competency Matrix: UI/UX L5 persona renamed to The Experience Architect.",
      "Competency Matrix: L1 cells rewritten so each opens with what the person can already do, then what still needs support. Instead of a list of failures.",
    ],
  },
  {
    version: "4.2",
    date: "Aug 7, 2026",
    // No `pillars` tag. The rename swept the whole app, but Section I never printed an L1-L5 anywhere,
    // so a Pillars dot would send a reader looking for a change they cannot find.
    sections: ["seniority", "matrix", "tracks"],
    // No bars moved: an intro rewrite and a caption, no cell text touched.
    changes: [
      "Career Growth Paths: career ladder renamed from L1-L5 to S1-S5 (career stages), so it no longer collides with the pillar proficiency scale. A bare L now always means a pillar level. Added a notation line under the section heading spelling out the difference.",
      "Proficiency Levels: intro rewritten to bridge pillar levels to career stages. Seniority reads from the whole chart shape, not from one axis.",
      "Competency Matrix: added a caption under the skill tier diagram, explaining that the tiers overlap on purpose and a focus area is not fixed to a level column.",
    ],
  },
  {
    version: "4.1",
    date: "Jul 25, 2026",
    sections: ["seniority", "matrix"],
    // No bars moved: tier labels renamed on the pillar cards, no cell text touched.
    changes: [
      "Proficiency Levels: renamed competency bands to skill tiers, which wrongly implied a band-to-level mapping of focus areas.",
      "Competency Matrix: skill tier labels on each pillar card updated to match the rename.",
    ],
  },
  {
    version: "4.0",
    date: "Jul 24, 2026",
    sections: ["seniority", "pillars", "matrix"],
    // Backfilled from the cell diff. 4.0 never shipped as a live version (the bump went 3.2 to 4.1), but the
    // marks still count: its content reached users inside 4.1, and movedLevelsSince unions every entry newer
    // than the stamp, so a 3.2-stamped profile picks these up.
    //
    // Most of the easing is a focus area moving OUT of a cell to its proper band rather than the level
    // genuinely softening: Secure Design and Observability left Architecture L2, Technical Shortcuts left
    // Product Sense L1, Initiative & De-risking left Ownership L2.
    barRaised: {
      coding: [1, 2, 3, 5],
      domainLogic: [1, 2, 3],
      architecture: [1, 4],
      ai: [1, 2, 3, 4],
      uiUx: [1, 2, 3, 4, 5],
      productSense: [2],
      process: [1, 2, 3, 4, 5],
      communication: [1, 2, 3, 4],
      ownership: [1, 3, 4],
    },
    barEased: {
      domainLogic: [4],
      architecture: [2, 3],
      productSense: [1, 4],
      ownership: [2],
    },
    changes: [
      "Seniority Levels: renamed to Proficiency Levels. Clarified they rate one pillar at a time, not overall seniority. Senior levels reframed around setting direction and lifting the team.",
      "Pillars: every pillar's focus summary rewritten to describe precise, tool-agnostic outcomes.",
      "Competency Matrix: each pillar's skillsets rewritten into focus areas, grouped into three cumulative skill tiers (Foundational, Core, Advanced) on the pillar card.",
      "Competency Matrix: full rewrite so every cell describes concrete, checkable behavior. Some L4/L5 personas rewritten to match.",
    ],
  },
  {
    version: "3.2",
    date: "Jul 15, 2026",
    // All four: the em-dash sweep in the last bullet touched every section's copy, so every section
    // is tagged. A bullet that says "all sections" has to list them, or it raises no dot at all.
    sections: ["pillars", "seniority", "matrix", "tracks"],
    // No bars moved: one L5 description condensed, no cell text touched.
    changes: [
      "Seniority Levels: condensed L5 description.",
      "Career Track: renamed to Career Growth Paths. Full rewrite, added junior to senior charts, updated senior fork charts, updated L6 role mapping.",
      "All sections: em-dashes replaced with plain punctuation.",
    ],
  },
  {
    version: "3.1",
    date: "Jul 8, 2026",
    sections: ["seniority", "matrix"],
    // No bars moved: the L5 persona names and column headers changed, the cell text did not.
    changes: [
      "Seniority Levels: level titles unified into quality/identity pairs.",
      "Competency Matrix: L5 persona rewrite and matrix column headers updated.",
    ],
  },
  {
    version: "3.0",
    date: "Jul 7, 2026",
    sections: ["pillars", "matrix"],
    // Backfilled from the cell diff. Like 4.0 this never shipped as a live version, but its marks still
    // count for any older stamp — see the note on 4.0.
    //
    // Nothing eased. UI/UX and Process are absent because both were reword-only (Process renamed personas,
    // e.g. The Shield to The Process Shield). Ownership L4 is also absent and is the one close call:
    // Mentorship left the cell, but the de-risking content that replaced it is comparably demanding, so the
    // two wash out rather than the bar dropping.
    barRaised: {
      coding: [2, 3],
      domainLogic: [1, 2, 3, 4],
      architecture: [1, 2, 3, 4],
      ai: [1, 5],
      productSense: [3, 4],
      communication: [1, 2, 3, 4],
      ownership: [2, 3],
    },
    changes: [
      "Pillars: focus summary rewrite.",
      "Competency Matrix: added missing competencies and fixed mentorship double counting.",
      "Competency Matrix: full rewrite with L4/L5 rescoped, observable behaviors added, personas revised.",
    ],
  },
  // {
  //   version: "2.9",
  //   date: "-",
  //   changes: ["Initial release"],
  // },
];

/**
 * `{ sectionId: version }` — for each Theory section, the NEWEST changelog version that touched it.
 * Derived from {@link CHANGELOG}'s `sections` fields, relying on the array being newest-first: the
 * first entry naming a section wins, so later (older) entries never overwrite it.
 *
 * A section absent from this map has no recorded change and can never raise a dot.
 */
export const SECTION_LATEST_VERSION = (() => {
  const latest = {};
  for (const { version, sections } of CHANGELOG) {
    for (const section of sections ?? []) {
      if (!(section in latest)) {
        latest[section] = version;
      }
    }
  }
  return latest;
})();

/**
 * The framework revision shown in the Theory tab, DERIVED from the newest changelog entry rather than
 * declared: the version and the entry that explains it cannot disagree, and a bump is a single edit here.
 *
 * It used to be a hand-maintained constant in storage.js, which made two failures possible — a bump with no
 * matching entry (the dev assert in useTheoryUpdates existed only to catch that, since an unranked version
 * leaves every unseen dot stuck on forever), and a version that disagreed with the changelog it was supposed
 * to summarise. Deriving it removes both by construction.
 *
 * Bump by ADDING AN ENTRY to the top of {@link CHANGELOG}, never by editing this. Only for genuinely new
 * material, never copy tweaks.
 *
 * ALSO READ AT BUILD TIME by vite-plugins/resolve-framework-version.js and published as `frameworkVersion`
 * in `dist/meta.json`, which the README's badge reads from the deployed site. That parser reads the first
 * `version:` in this file, so keep the newest entry first (which the authoring rules already require).
 */
export const FRAMEWORK_VERSION = CHANGELOG[0].version;

/**
 * The date of the newest changelog entry, derived for the same reason as {@link FRAMEWORK_VERSION}.
 *
 * Display only, and print-only at that: it is NOT a key, and nothing compares or parses it. Screen surfaces
 * reach the date through ChangelogModal, so only the printed hero plate renders it (see TheoryContent).
 * Free-form, matching the `date` field it reads.
 */
export const FRAMEWORK_UPDATED = CHANGELOG[0].date;

/**
 * Ordering key for a changelog version: its POSITION in {@link CHANGELOG}, where 0 is newest, so a SMALLER
 * rank means newer. Indexed rather than parsed, which cannot misorder "4.10" vs "4.2".
 *
 * A position, never a distance. The two out-of-range results are sentinels meaning "absent from the array":
 * `Infinity` (unplaceable, so it reads as ancient and raises every dot) and `-1` (numerically ahead of the
 * newest entry, the rollback case, raising none). See docs/DECISIONS.md#changelog-rank-sentinels.
 */
export function changelogRank(version) {
  const index = CHANGELOG.findIndex((entry) => entry.version === version);
  if (index !== -1) {
    return index;
  }
  return isAheadOfNewest(version) ? -1 : Number.POSITIVE_INFINITY;
}

/**
 * Whether an unrecognized version number sits ahead of the newest changelog entry. Only reached for
 * versions absent from the array, so the numeric-parse caveat that `changelogRank` exists to avoid
 * doesn't apply to ordering *within* the changelog — this is purely an off-the-end test.
 */
function isAheadOfNewest(version) {
  const parsed = parseVersion(version);
  const newest = parseVersion(CHANGELOG[0]?.version);
  if (parsed === null || newest === null) {
    return false;
  }
  return parsed > newest;
}

/** "4.10" → 4.010, so minor numbers compare by magnitude rather than lexically. null if unparsable. */
function parseVersion(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = /^(?<major>\d+)(?:\.(?<minor>\d+))?/.exec(version.trim());
  if (!match) {
    return null;
  }
  const { major, minor } = match.groups;
  return Number(major) + Number(minor ?? 0) / 1000;
}

/** True when `version` is strictly newer than `seenVersion` (see {@link changelogRank}). */
export function isNewerVersion(version, seenVersion) {
  return changelogRank(version) < changelogRank(seenVersion);
}

// Dev-only guard: a typo'd section id would silently mean "no dot for this change", which is
// invisible until someone notices a bump that never announced itself. Fail loudly in dev instead.
if (import.meta.env.DEV) {
  const valid = new Set(Object.values(THEORY_SECTIONS));
  const unknown = Object.keys(SECTION_LATEST_VERSION).filter((section) => !valid.has(section));
  if (unknown.length > 0) {
    console.error(`CHANGELOG: unknown section id(s) ${unknown.join(", ")}. Valid ids: ${[...valid].join(", ")}.`);
  }
  // A draft at or below the published version means it was published without clearing CHANGELOG_DRAFT, so
  // the modal is showing a shipped version as unreleased.
  if (CHANGELOG_DRAFT && !isAheadOfNewest(CHANGELOG_DRAFT.version)) {
    console.error(`CHANGELOG_DRAFT: v${CHANGELOG_DRAFT.version} is not ahead of the published v${FRAMEWORK_VERSION}. Set it to null once published.`);
  }
  // Same reasoning for barRaised/barEased: a typo'd pillar id means "nobody is ever flagged for this
  // pillar", and a level outside 1-5 has no band, so both fail silently and permanently.
  const pillarIds = new Set(Object.keys(PILLARS));
  for (const { version, barRaised, barEased } of CHANGELOG) {
    for (const [field, moved] of [
      ["barRaised", barRaised],
      ["barEased", barEased],
    ]) {
      for (const [pillar, levels] of Object.entries(moved ?? {})) {
        if (!pillarIds.has(pillar)) {
          console.error(`CHANGELOG v${version} ${field}: unknown pillar id "${pillar}". Valid ids: ${[...pillarIds].join(", ")}.`);
          continue;
        }
        if (!Array.isArray(levels) || levels.some((l) => !Number.isInteger(l) || l < 1 || l > 5)) {
          console.error(`CHANGELOG v${version} ${field}.${pillar}: levels must be integers 1-5, got ${JSON.stringify(levels)}.`);
        }
      }
    }
    // A cell cannot get harder and easier in the same release, and nothing else catches the overlap.
    for (const [pillar, levels] of Object.entries(barRaised ?? {})) {
      const both = (barEased?.[pillar] ?? []).filter((l) => Array.isArray(levels) && levels.includes(l));
      if (both.length > 0) {
        console.error(`CHANGELOG v${version}: ${pillar} L${both.join(", L")} appears in both barRaised and barEased.`);
      }
    }
  }
}
