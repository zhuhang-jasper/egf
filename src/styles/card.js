/** Shared card surface for every card in the app, so the six files that used to spell it out cannot drift. */
const CARD_SHADOW = "shadow-none";

/** Plain card: the chart card, the theory tab's level/tier cards, the admin tiles. */
export const CARD_PLAIN = `rounded-xl border border-slate-200 bg-page-surface ${CARD_SHADOW}`;

/** Cluster-tinted card: colour comes from the inline style below, this only sets widths. */
export const CARD_TINTED = "rounded-xl border border-l-[3px] shadow-none";

/** Border mix vs. slate-200: 20% read as ~invisible against a tinted (non-white) fill. */
const BORDER_MIX = "40%";

/** Border only, split from the fill since CompetencyMatrix needs the fill as a custom property for hover. */
export function clusterCardBorder(bezel) {
  return {
    borderColor: `color-mix(in srgb, ${bezel} ${BORDER_MIX}, white)`,
    borderLeftColor: bezel,
    boxShadow: "none",
  };
}

/** The usual pairing: cluster surface fill plus the shared border. */
export function clusterCardStyle(surfaceBg, bezel) {
  return {
    backgroundColor: surfaceBg,
    ...clusterCardBorder(bezel),
  };
}

export { CARD_SHADOW };
