/**
 * Shared card surface for every card in the app, so the six files that used to spell it out cannot drift.
 * Shadow-less for now (an experiment in flattening every card at once) — restore the two-layer tinted
 * shadow here to bring elevation back everywhere in one edit.
 */
const CARD_SHADOW = "shadow-none";

/** Plain card: the chart card, the theory tab's level/tier cards, the admin tiles. */
export const CARD_PLAIN = `rounded-xl border border-slate-200 bg-page-surface ${CARD_SHADOW}`;

/**
 * Cluster-tinted card: a 3px coloured left bezel plus a border/shadow on the other three sides, both tinted
 * toward the cluster (see `clusterCardStyle`) rather than plain slate — the tinted surface colours sit close
 * in lightness to the page behind them (unlike the plain card's white), so a neutral slate edge read as a
 * mismatched grey outline against them. `border` (not `border-slate-200`) leaves the colour to the inline
 * style below; the class only sets widths. `shadow-none` clears CARD_SHADOW since the inline style carries
 * a cluster-tinted box-shadow instead. Kept light (see `clusterCardStyle`) — the bezel is the one vivid edge.
 */
export const CARD_TINTED = "rounded-xl border border-l-[3px] shadow-none";

/**
 * The inline half of {@link CARD_TINTED}: surface fill, a full-strength `color` left bezel (the one vivid
 * edge), and a border/shadow tinted toward `color` but kept light — `20%` mixed into white lands the border
 * at roughly slate-200's own lightness (~90%) with the cluster's hue instead of grey, and the shadow stays
 * at CARD_SHADOW's original low opacity, just recoloured instead of darkened.
 */
export function clusterCardStyle(surfaceBg, color) {
  const borderColor = `color-mix(in srgb, ${color} 20%, white)`;
  return {
    backgroundColor: surfaceBg,
    borderColor,
    borderLeftColor: color,
    boxShadow: "none",
  };
}

export { CARD_SHADOW };
