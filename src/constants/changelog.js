import { THEORY_SECTIONS } from "@/utils/theory-url";

// Theory-tab changelog, surfaced via the "Show changelog" button (see ChangelogModal). Newest entry
// FIRST — the modal renders the array in order, top to bottom.
//
// Each entry:
//   version — display string (e.g. "3.2"); shown as `v{version}` in the modal.
//   date    — human-readable release date string (e.g. "Jul 2026"). Free-form; rendered as-is.
//   changes — array of plain-text bullet strings. `**bold**` markers are NOT parsed here — write
//             plain sentences (add EmphasizedText later if you want in-bullet emphasis).
//
// Newest version first. Summaries list which sections changed, not every detail.
//
// This changelog covers the THEORY TAB, not the source PDF. The PDF's own changelog carries entries
// for material that never shipped here (e.g. the v4.1 removal of the archetype and neighbor-role
// placeholders, which this tab never rendered). Skip those. A bullet earns its place only when a
// reader can open the Theory tab and see what it describes.
//
// Refer to sections by NAME ("Pillars", "Proficiency Levels", "Career Growth Paths", "Competency
// Matrix"), never by roman numeral. The numerals are positional and would silently go stale the
// moment a section is reordered or inserted. Names survive that.
//
// Each entry is a historical record: use the name the section carried AT THAT VERSION, not today's.
// "Seniority Levels" was renamed to "Proficiency Levels" in v4.0, so entries at v3.x keep the old
// name and the v4.0 entry records the rename itself. Do not retitle past entries on a later rename.
//
// Style: prefix each bullet with the section name and a colon, then write plain sentences. No
// em-dashes and no semicolons in the copy. Split a long clause into two sentences instead.
//
// `sections` — which Theory sections the entry touched, as THEORY_SECTIONS ids. This is what drives
// the per-section unseen dots (see useTheoryUpdates): a section's dot lights up when its newest
// touching version is one the user has not scrolled past yet. Keep it in sync with the bullets —
// a bullet naming a section whose id is missing here gets no dot. Omit the field for an entry that
// should not raise any dot. Ids are validated against THEORY_SECTIONS at module load in dev.
//
// Name the section where the change RENDERS, not the concept it belongs to. These come apart more
// often than you'd expect: the skill tiers are a proficiency-level idea, but the per-pillar tier
// lists draw on the Matrix pillar cards, so a tier-list change is a Matrix bullet. When one change
// shows up in two sections, write one bullet per section and tag both — a reader who follows a
// bullet's section name must actually find the change there.
//
// One section prefix per bullet. "Pillars and Competency Matrix: ..." reads fine but leaves the
// reader guessing which half landed where, so split it into two bullets instead. Likewise a bullet
// covering everything ("All sections: ...") still has to tag every section explicitly.
export const CHANGELOG = [
  {
    version: "4.1",
    date: "Jul 25, 2026",
    sections: ["seniority", "matrix"],
    changes: [
      "Proficiency Levels: renamed competency bands to skill tiers, which wrongly implied a band-to-level mapping of focus areas.",
      "Competency Matrix: skill tier labels on each pillar card updated to match the rename.",
    ],
  },
  {
    version: "4.0",
    date: "Jul 24, 2026",
    sections: ["seniority", "pillars", "matrix"],
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
    changes: [
      "Seniority Levels: level titles unified into quality/identity pairs.",
      "Competency Matrix: L5 persona rewrite and matrix column headers updated.",
    ],
  },
  {
    version: "3.0",
    date: "Jul 7, 2026",
    sections: ["pillars", "matrix"],
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
 * Ordering key for a changelog version: its POSITION in {@link CHANGELOG}, where 0 is the NEWEST — so
 * a SMALLER rank means newer. Ordering by array index rather than by parsing "4.1" as a number is
 * deliberate: it can't misorder "4.10" vs "4.2", and it makes the array the one source of truth.
 *
 * Rank is a position, never a distance. "Two versions behind" is simply a larger index; there is no
 * staleness threshold anywhere in here, and nothing is measured in major/minor steps.
 *
 * The two out-of-range results are SENTINELS meaning "absent from the array", not measurements:
 *
 *   - `Infinity` — unknown and not ahead of the newest entry, so it can't be placed on the scale.
 *     Reads as older than every real entry, which raises a dot on every changed section. This is the
 *     long-absent user: a v2.9 stamp lands here because v2.9 is commented out below, NOT because 2.9
 *     is numerically far from 4.1. Uncomment that entry and the same stamp gets a finite rank.
 *   - `-1` — numerically ahead of the newest entry, so it reads as newer than everything and raises
 *     NO dots. This is the rollback case: a user who read a section at v4.2 keeps that stamp after
 *     v4.2 is reverted, and treating them as ancient would light every dot with no way to clear them.
 *
 * Only the `-1` branch parses version numbers, and only as an off-the-end test (see isAheadOfNewest);
 * there is no oldest-end numeric bound, because anything unplaceable already defaults to `Infinity`.
 * A malformed or hand-edited value therefore lands on `Infinity` — showing dots is the safe failure,
 * since the cost is a re-read rather than silently swallowed updates.
 *
 * CONSEQUENCE: the array's length is the horizon. Pruning old entries shifts users still sitting at
 * those versions from a finite rank to `Infinity`. Harmless today — both show every dot — but it
 * would start to matter if anything ever read the rank as a count of versions behind.
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
}
