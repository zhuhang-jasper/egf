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
export const CHANGELOG = [
  {
    version: "4.1",
    date: "Jul 25, 2026",
    changes: ["Proficiency Levels: renamed competency bands to skill tiers, which wrongly implied a band-to-level mapping of focus areas."],
  },
  {
    version: "4.0",
    date: "Jul 24, 2026",
    changes: [
      "Seniority Levels: renamed to Proficiency Levels. Clarified they rate one pillar at a time, not overall seniority. Senior levels reframed around setting direction and lifting the team.",
      "Pillars: every pillar's skillsets rewritten into precise, tool-agnostic focus areas grouped into three skill tiers (Foundational, Core, Advanced).",
      "Competency Matrix: full rewrite so every cell describes concrete, checkable behavior. Some L4/L5 personas rewritten to match.",
    ],
  },
  {
    version: "3.2",
    date: "Jul 15, 2026",
    changes: [
      "Seniority Levels: condensed L5 description.",
      "Career Track: renamed to Career Growth Paths. Full rewrite, added junior to senior charts, updated senior fork charts, updated L6 role mapping.",
      "All sections: em-dashes replaced with plain punctuation.",
    ],
  },
  {
    version: "3.1",
    date: "Jul 8, 2026",
    changes: [
      "Seniority Levels: level titles unified into quality/identity pairs.",
      "Competency Matrix: L5 persona rewrite and matrix column headers updated.",
    ],
  },
  {
    version: "3.0",
    date: "Jul 7, 2026",
    changes: [
      "Pillars and Competency Matrix: focus summary rewrite, added missing competencies, fixed mentorship double counting.",
      "Competency Matrix: full rewrite with L4/L5 rescoped, observable behaviors added, personas revised.",
    ],
  },
  // {
  //   version: "2.9",
  //   date: "-",
  //   changes: ["Initial release"],
  // },
];
