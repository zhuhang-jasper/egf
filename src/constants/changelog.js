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
export const CHANGELOG = [
  {
    version: "3.2",
    date: "Jul 15, 2026",
    changes: [
      "Section II — condensed L5 description.",
      "Section III — renamed section, full rewrite, added junior to senior charts, updated senior fork charts, updated L6 role mapping.",
      "All sections — em-dashes replaced with plain punctuation.",
    ],
  },
  {
    version: "3.1",
    date: "Jul 8, 2026",
    changes: ["Section II — level titles unified into quality/identity pairs.", "Section IV — L5 persona rewrite and matrix column headers updated."],
  },
  {
    version: "3.0",
    date: "Jul 7, 2026",
    changes: [
      "Section I & IV — focus summary rewrite, added missing competencies, fixed mentorship double counting.",
      "Section IV — full matrix rewrite: L4/L5 rescoped, observable behaviors added, personas revised.",
    ],
  },
  // {
  //   version: "2.9",
  //   date: "-",
  //   changes: ["Initial release"],
  // },
];
