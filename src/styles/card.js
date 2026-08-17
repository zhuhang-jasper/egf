/** Shared card surface for every card in the app, so the six files that used to spell it out cannot drift. */
const CARD_SHADOW = "shadow-none";

/** Plain card: the chart card, the theory tab's level/tier cards, the admin tiles. */
export const CARD_PLAIN = `rounded-xl border border-slate-200 bg-page-surface ${CARD_SHADOW}`;

/** Cluster-tinted card: colour comes from the inline style below, this only sets widths. */
export const CARD_TINTED = "rounded-xl border border-l-[3px] shadow-none";

/**
 * Surface fill, a brightened left bezel, and a border tinted toward `bezel` but kept near slate-200's
 * lightness. `bezel` is CLUSTERS[id].bezel — a precomputed static colour, not derived at render, so the
 * theory tab, tool tab, and poster all draw from the same source.
 */
export function clusterCardStyle(surfaceBg, bezel) {
  return {
    backgroundColor: surfaceBg,
    borderColor: `color-mix(in srgb, ${bezel} 20%, white)`,
    borderLeftColor: bezel,
    boxShadow: "none",
  };
}

export { CARD_SHADOW };
