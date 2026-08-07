/**
 * Shared typography for the documentation tab. Three-tier ramp on the standardized breakpoints:
 * base (<640) → sm (640) → md (768). Body scales 12 → 13 → 14; titles 13 → 14 → 15; smaller
 * supporting tokens step up in parallel so nothing stays flat through the 640–768 band.
 *
 * ONE GREY LADDER, five rungs, darkest to lightest. Every piece of text on the docs page takes its color
 * from this and nothing else:
 *
 *   slate-900  headings — section titles, subsection titles, and titles inside a card (`cardTitle`,
 *              `bodySemibold`). A title is a title on either surface; only prose steps back in a card.
 *   slate-800  page prose — section and subsection lead-ins (`DOC_SECTION.intro`).
 *   slate-700  in-card emphasis — the framework's own voice annotating a card, bold italic
 *              (`bodyItalic`: the signature questions, the BE UI/UX note).
 *   slate-600  in-card body — level descriptions, matrix cells, track summaries, focus areas, chart
 *              role labels, and the tier card's L1-L5 ruler.
 *   slate-500  captions — 11px annotations attached to a figure (`metaBody`).
 *
 * TWO THINGS DECIDE THE RUNG: whether the text is on the page or inside a card, then what job it does
 * there. The page's own voice is darker; a card is a quieter object sitting on it, so its contents step
 * back. Both questions are answerable at a glance from the JSX, which is the point — the ladder only
 * holds if picking a rung never requires an opinion.
 *
 * IT REPLACED FOUR GREYS (800 / 600 / 500 / 400) that had drifted across the same job: a track card's
 * summary and a level card's description are the same kind of text and rendered two shades apart, the
 * Section IV subsection lead-ins came out lighter than the section intro directly above them, and the
 * skill-tier card sat a step below every other card.
 *
 * NO NEW RUNGS, and no shades between them. The five are deliberately one stop apart with nothing spare:
 * at 12-14px a half-step is invisible as a system and reads as drift, and every gap that gets filled
 * makes the remaining distinctions harder to see. Text that needs to outrank its neighbours has size and
 * weight available — use those. If the ramp genuinely needs retuning, move a rung here rather than
 * overriding a color at the call site, since a one-off shade is exactly how the previous drift started.
 */
export const DOC_TEXT = {
  // Same slate-600 in-card grey; `bodyMedium` differs only in WEIGHT, for prose that carries a card
  // (a track's summary, a matrix level cell) over prose that supports one (a focus-area list).
  body: "text-[12px] sm:text-[13px] md:text-[14px] leading-snug text-slate-600",
  bodyMedium: "text-[12px] sm:text-[13px] md:text-[14px] font-medium leading-snug text-slate-600",
  // A title INSIDE a card (the level cards' "Quality / Identity" phase), so it takes the headings rung
  // like `cardTitle` does. It was 800 — the page-prose color — which is the one rung an in-card token
  // should never borrow.
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

  meta: "text-[11px] sm:text-[12px] md:text-[13px] font-medium uppercase tracking-wide text-slate-700 text-right",
  // The bottom rung: a caption or annotation attached to a figure, one size AND one shade below in-card
  // body. Both steps are doing work — 11px alone reads as small print, 500 alone as faint body.
  metaBody: "text-[11px] sm:text-[12px] md:text-[13px] leading-snug text-slate-500",

  clusterLabel: "text-[11px] sm:text-[12px] md:text-[13px] font-semibold uppercase leading-snug tracking-wider",

  chip: "text-[11px] sm:text-[12px] md:text-[13px] font-medium leading-none",

  badgeMicro: "text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-none",
  badgeSm: "text-[11px] sm:text-[12px] md:text-[13px] font-bold leading-none tabular-nums",
  badgeMd: "text-[12px] sm:text-[13px] md:text-[14px] font-bold",
};

export const DOC_SECTION = {
  title: "text-[16px] sm:text-[17px] md:text-[18px] font-semibold tracking-tight text-slate-900",
  /**
   * The page-prose rung (slate-800) — see the grey ladder in the DOC_TEXT docblock. Used by BOTH
   * the h2 section intros and the h3 subsection lead-ins in Section IV: a lead-in hanging off a heading
   * is the page talking, wherever it sits in the hierarchy, so both take this rather than a card grey.
   * Body size matches `DOC_TEXT.body` exactly; only the color differs.
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
