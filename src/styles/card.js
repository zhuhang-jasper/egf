/**
 * Shared card surface for every card in the app, so the six files that used to spell it out cannot drift.
 * The shadow is two layers on the page base's own hue (215) — retint it if `--color-page-base` moves.
 */
const CARD_SHADOW = "shadow-[0_1px_2px_-1px_rgb(51_65_92_/_0.10),0_4px_12px_-2px_rgb(51_65_92_/_0.10)]";

/** Plain card: the chart card, the theory tab's level/tier cards, the admin tiles. */
export const CARD_PLAIN = `rounded-xl border border-slate-200 bg-page-surface ${CARD_SHADOW}`;

/**
 * Cluster-tinted card: a 3px left bezel and nothing on the other three sides, fed by `clusterCardStyle`.
 * All four widths are stated because `* { @apply border-border }` in index.css colours every element,
 * so an unstated side would paint the moment anything gave it a width.
 */
export const CARD_TINTED = `rounded-xl border-y-0 border-r-0 border-l-[3px] ${CARD_SHADOW}`;

/** The inline half of {@link CARD_TINTED} — only the left side has a width, so only it gets a colour. */
export function clusterCardStyle(surfaceBg, color) {
  return { backgroundColor: surfaceBg, borderLeftColor: color };
}

export { CARD_SHADOW };
