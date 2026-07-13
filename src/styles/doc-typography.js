/** Shared typography for the documentation tab. Body scale matches tool form labels (12px mobile → 14px desktop). */
export const DOC_TEXT = {
  body: "text-[12px] sm:text-[14px] leading-snug text-slate-500",
  bodyMedium: "text-[12px] sm:text-[14px] font-medium leading-snug text-slate-600",
  bodySemibold: "text-[12px] sm:text-[14px] font-semibold leading-snug text-slate-800",
  bodyItalic: "text-[12px] sm:text-[14px] font-bold italic leading-snug text-slate-700",
  bodyDimMedium: "text-[11px] sm:text-[12px] font-medium leading-snug text-slate-600",

  cardTitle: "text-[13px] sm:text-[15px] font-semibold leading-snug text-slate-900",
  cardTitlePlain: "text-[13px] sm:text-[15px] font-semibold text-slate-900",

  meta: "text-[11px] sm:text-[12px] font-medium uppercase tracking-wide text-slate-700 text-right",
  metaBody: "text-[11px] sm:text-[12px] leading-snug text-slate-500",

  clusterLabel: "text-[11px] sm:text-[12px] font-semibold uppercase leading-snug tracking-wider",

  chip: "text-[11px] sm:text-[12px] font-medium leading-none",

  badgeMicro: "text-[10px] sm:text-[12px] font-bold leading-none",
  badgeSm: "text-[11px] sm:text-[12px] font-bold leading-none tabular-nums",
  badgeMd: "text-[12px] sm:text-[14px] font-bold",
};

export const DOC_SECTION = {
  title: "text-[16px] sm:text-[18px] font-semibold tracking-tight text-slate-900",
  intro: "text-[12px] sm:text-[14px] leading-snug text-slate-800",
};

/**
 * Soft amber highlighter for the newer/expanded framework material (wrapped in **…** in the copy),
 * toggled by the Theory tab's "What's New" switch. A marker-pen fill at normal weight reads as
 * "what's new" rather than as an emphasized keyword, and the amber sits clearly on every cluster
 * surface tint. `box-decoration-clone` keeps the fill continuous when a phrase wraps across lines.
 */
export const WHATS_NEW_HIGHLIGHT_CLASS = "rounded-[3px] bg-amber-200/60 box-decoration-clone px-0.5 font-normal text-slate-800";
