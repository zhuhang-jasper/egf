/**
 * Shared typography for the documentation tab. Three-tier ramp on the standard breakpoints, so nothing
 * stays flat through the 640-768 band.
 *
 * ONE GREY LADDER. Every piece of text on the docs page takes its colour from this and nothing else:
 *
 *   slate-900  headings — section and subsection titles, and titles inside a card
 *   slate-800  page prose — section and subsection lead-ins (`DOC_SECTION.intro`)
 *   slate-700  in-card emphasis — the framework's own voice annotating a card (`bodyItalic`)
 *   slate-600  in-card body — level descriptions, matrix cells, track summaries, focus areas
 *   slate-500  captions — annotations attached to a figure (`metaBody`)
 *
 * Pick a rung by asking whether the text is on the page or inside a card, then what job it does there.
 * NO NEW RUNGS and no shades between them. See docs/DECISIONS.md#docs-grey-ladder.
 */
export const DOC_TEXT = {
  // Same slate-600 in-card grey; `bodyMedium` differs only in WEIGHT, for prose that carries a card
  // (a track's summary, a matrix level cell) over prose that supports one (a focus-area list).
  body: "text-[12px] sm:text-[13px] md:text-[14px] leading-snug text-slate-600",
  bodyMedium: "text-[12px] sm:text-[13px] md:text-[14px] font-medium leading-snug text-slate-600",
  // A title INSIDE a card, so it takes the headings rung like `cardTitle` does rather than the page-prose
  // 800, which is the one rung an in-card token should never borrow.
  bodySemibold: "text-[12px] sm:text-[13px] md:text-[14px] font-semibold leading-snug text-slate-900",
  bodyItalic: "text-[12px] sm:text-[13px] md:text-[14px] font-bold italic leading-snug text-slate-700",
  bodyDimMedium: "text-[11px] sm:text-[12px] md:text-[13px] font-medium leading-snug text-slate-600",

  cardTitle: "text-[13px] sm:text-[14px] md:text-[15px] font-semibold leading-snug text-slate-900",
  cardTitlePlain: "text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-slate-900",

  /**
   * Sub-heading that divides a section but is not the section heading itself (e.g. "From Junior to
   * Senior", "The Senior Fork"). Sits between DOC_SECTION.title and cardTitle so a heading that owns
   * several cards still outranks the titles inside them.
   */
  subsectionTitle: "text-[14px] sm:text-[15px] md:text-[16px] font-semibold leading-snug tracking-tight text-slate-900",

  // The bottom rung: a caption or annotation attached to a figure, one size AND one shade below in-card
  // body. Both steps are doing work — 11px alone reads as small print, 500 alone as faint body.
  metaBody: "text-[11px] sm:text-[12px] md:text-[13px] leading-snug text-slate-500",

  clusterLabel: "text-[11px] sm:text-[12px] md:text-[13px] font-semibold uppercase leading-snug tracking-wider",

  badgeMicro: "text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-none",
  /**
   * A rung BELOW `badgeMicro`, and the smallest type on the docs tab: the career-track charts' spoke labels and
   * the tier chips beside them, both of which sit inside a ~180px chart card rather than in the page column.
   * Added because two call sites had inlined this exact ramp — the tier exists whether or not it is named, and
   * naming it is what stops the third one drifting a pixel.
   */
  badgeNano: "text-[9px] sm:text-[10px] md:text-[11px] font-bold leading-none",
  badgeSm: "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-none tabular-nums",
  badgeMd: "text-[12px] sm:text-[13px] md:text-[14px] font-bold",
};

export const DOC_SECTION = {
  title: "text-[16px] sm:text-[17px] md:text-[18px] font-semibold tracking-tight text-slate-900",
  /**
   * The page-prose rung (see the grey ladder in DOC_TEXT). Used by both h2 section intros and h3
   * subsection lead-ins: a lead-in hanging off a heading is the page talking, wherever it sits. Size
   * matches `DOC_TEXT.body` exactly; only the color differs.
   */
  intro: "text-[12px] sm:text-[13px] md:text-[14px] leading-snug text-slate-800",
};

/**
 * Soft amber highlighter for the newer/expanded framework material (wrapped in **…** in the copy),
 * toggled by the Theory tab's "What's New" switch. A marker-pen fill at normal weight reads as
 * "what's new" rather than as an emphasized keyword, and the amber sits clearly on every cluster
 * surface tint. `box-decoration-clone` keeps the fill continuous when a phrase wraps across lines.
 */
export const WHATS_NEW_HIGHLIGHT_CLASS = "rounded-[3px] bg-amber-200/60 box-decoration-clone px-0.5 font-normal text-slate-800";
