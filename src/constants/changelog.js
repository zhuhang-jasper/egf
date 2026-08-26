import { PILLARS } from "@/constants/framework";
import { THEORY_SECTIONS } from "@/utils/theory-url";

// Theory-tab changelog, rendered top to bottom by ChangelogModal. Newest entry FIRST: several readers and a
// build-time regex depend on it. `sections` lists THEORY_SECTIONS ids and drives the per-section unseen dots
// (see useTheoryUpdates); it is validated at module load in dev.
// Authoring rules and the barRaised/barEased convention:
// see docs/DECISIONS.md#changelog-entries-are-what-the-theory-tab-shows

/**
 * The unpublished entry, shown behind a Draft badge and deliberately NOT part of {@link CHANGELOG}.
 * To publish: add `date` and `sections`, move it into CHANGELOG's first slot, set this to null.
 * See docs/DECISIONS.md#changelog-draft-is-a-separate-export
 */
export const CHANGELOG_DRAFT = null;

export const CHANGELOG = [
  {
    version: "4.3",
    date: "Aug 20, 2026",
    sections: ["pillars", "matrix"],
    // 40 of the 45 cells were reworked here, but most kept the same bar, so only these are marked.
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
    // Backfilled: 4.0 never shipped live (the bump went 3.2 to 4.1), but its content reached users inside
    // 4.1. Most of the easing is a focus area moving OUT of a cell to its proper band rather than the level
    // genuinely softening.
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
    // The em-dash sweep touched every section's copy, so all four are tagged.
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
    // Backfilled, like 4.0. Nothing eased. UI/UX and Process were reword-only. Ownership L4 is the close
    // call: Mentorship left the cell, but its replacement is comparably demanding, so the two wash out.
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
 * `{ sectionId: version }` — the newest changelog version touching each Theory section. Relies on
 * {@link CHANGELOG} being newest-first: the first entry naming a section wins. A section absent from the map
 * can never raise a dot.
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
 * The framework revision shown in the Theory tab. Bump by ADDING AN ENTRY to the top of {@link CHANGELOG},
 * never by editing this, and only for genuinely new material.
 * Also read at build time by vite-plugins/resolve-framework-version.js and published as `frameworkVersion`
 * in `dist/meta.json`, which the README badge reads.
 * See docs/DECISIONS.md#changelog-draft-is-a-separate-export
 */
export const FRAMEWORK_VERSION = CHANGELOG[0].version;

/**
 * The date of the newest changelog entry. Display only and print-only: nothing compares or parses it, and
 * only the printed hero plate renders it (screen surfaces reach the date through ChangelogModal).
 */
export const FRAMEWORK_UPDATED = CHANGELOG[0].date;

/**
 * A version's POSITION in {@link CHANGELOG}, where 0 is newest, so a SMALLER rank means newer. Indexed rather
 * than parsed, which cannot misorder "4.10" vs "4.2". A position, never a distance; the out-of-range results
 * are sentinels. See docs/DECISIONS.md#changelog-rank-sentinels.
 */
export function changelogRank(version) {
  const index = CHANGELOG.findIndex((entry) => entry.version === version);
  if (index !== -1) {
    return index;
  }
  return isAheadOfNewest(version) ? -1 : Number.POSITIVE_INFINITY;
}

/**
 * Whether an unrecognized version sits ahead of the newest entry. Only reached for versions absent from the
 * array, so this is purely an off-the-end test, not ordering within the changelog.
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

// Dev-only guard: a typo'd section id silently means "no dot for this change", invisible until someone
// notices a bump that never announced itself.
if (import.meta.env.DEV) {
  const valid = new Set(Object.values(THEORY_SECTIONS));
  const unknown = Object.keys(SECTION_LATEST_VERSION).filter((section) => !valid.has(section));
  if (unknown.length > 0) {
    console.error(`CHANGELOG: unknown section id(s) ${unknown.join(", ")}. Valid ids: ${[...valid].join(", ")}.`);
  }
  // A draft at or below the published version was published without clearing CHANGELOG_DRAFT, so the modal
  // is showing a shipped version as unreleased.
  if (CHANGELOG_DRAFT && !isAheadOfNewest(CHANGELOG_DRAFT.version)) {
    console.error(`CHANGELOG_DRAFT: v${CHANGELOG_DRAFT.version} is not ahead of the published v${FRAMEWORK_VERSION}. Set it to null once published.`);
  }
  // Same reasoning: a typo'd pillar id means nobody is ever flagged for it, and a level outside 1-5 has no
  // band, so both fail silently and permanently.
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
