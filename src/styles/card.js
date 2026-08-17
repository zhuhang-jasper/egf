/**
 * ONE CARD SURFACE, DEFINED ONCE. Every card in the app — the chart card, the theory tab's plain cards, the
 * cluster-tinted cards, the admin tiles — takes its border, radius and shadow from here.
 *
 * Before this, six files each spelled out `rounded-xl border border-… shadow-md shadow-slate-200/40`, and a
 * change to the app's card look meant finding all six and hoping they had agreed to begin with. Two of them
 * had already drifted (`border-white/70` vs `border-slate-300`), which is what made the tinted cards look
 * borderless once the page went off-white.
 *
 * THE SHADOW IS COLOURED, NOT NEUTRAL GREY, and it is a TWO-LAYER cast rather than Tailwind's single `shadow-md`.
 * Both of those are what separate a card that looks lifted from one with a grey rectangle behind it: the near
 * layer is tight and holds the edge, the far layer is soft and wide. The colour is a desaturated slate-blue
 * drawn from the page base's own hue (215), so the shadow reads as this page's shadow rather than a default
 * black-at-low-opacity pasted underneath.
 *
 * Retint these two `rgb()` values together with `--color-page-base` if its hue ever moves.
 */

/** The shared shadow: two stacked layers on the base's hue, so the near edge reads tight and the falloff soft. */
const CARD_SHADOW = "shadow-[0_1px_2px_-1px_rgb(51_65_92_/_0.10),0_4px_12px_-2px_rgb(51_65_92_/_0.10)]";

/**
 * A PLAIN card: white-ish surface, visible border, warm shadow. The theory tab's seniority ladder and skill
 * tier figure, the chart card, the admin tiles.
 *
 * `border-slate-200` is a REAL border, unlike the `border-white/70` two of these sites used to carry — that
 * one is invisible against a white card and only ever read as an edge because the page behind it was darker.
 * Which is exactly why "add borders to all cards" was on the list: half of them did not have one.
 */
export const CARD_PLAIN = `rounded-xl border border-slate-200 bg-page-surface ${CARD_SHADOW}`;

/**
 * A CLUSTER-TINTED card: the 3px left bezel in the cluster's own colour, and NO border on the other three
 * sides. The caller supplies both colours via inline styles (per-cluster and computed, so neither can live in
 * a class) — see {@link clusterCardStyle}, which is the only correct way to feed this.
 *
 * THE BEZEL IS THE WHOLE EDGE TREATMENT. The other three sides used to carry `border-white/70`, which was
 * invisible while the page was white and became a halo ringing every card once the page took its own tint.
 * Bordering all four sides in the cluster colour was tried instead and looked worse — a coloured outline around
 * an already-coloured surface reads as a sticker. So the three sides get NOTHING: the card is bounded by its
 * tint against the page, `CARD_SHADOW` lifts it, and the bezel marks which cluster it belongs to. One edge,
 * one job.
 *
 * `border-l-[3px] border-y-0 border-r-0` states all four explicitly. Do not shorten it to `border-l-[3px]`
 * alone — `* { @apply border-border }` in index.css gives every element a border colour, and Tailwind's
 * preflight a 0 width, so relying on the default here works only until something sets a width upstream.
 *
 * NO `bg-*` OR BORDER-COLOUR CLASS, deliberately: both arrive as inline styles, and an inline style beats any
 * utility, so a colour class here would be silently dead code.
 */
export const CARD_TINTED = `rounded-xl border-y-0 border-r-0 border-l-[3px] ${CARD_SHADOW}`;

/**
 * The inline half of {@link CARD_TINTED}: the per-cluster tint and bezel. Pass a cluster's `color` (the pale
 * fill hex) and its `textColor` (the saturated one used for its label).
 *
 * `borderLeftColor` ONLY — the other three sides have no width, so colouring them would be inert, and naming
 * just the one that paints keeps this honest about what it does.
 *
 * The bezel takes the cluster's TEXT colour at FULL strength, not its fill: the fill is already the card's
 * background, so a bezel in the same hex would be invisible by construction. The text colour is that hue
 * several steps darker, which is what an edge wants — and unlike the four-side version this is a 3px mark
 * rather than an outline, so it takes no alpha.
 */
export function clusterCardStyle(color, textColor) {
  return { backgroundColor: `${color}55`, borderLeftColor: textColor };
}

/**
 * The shadow alone, for the handful of boxes that are card-like without being cards — the cluster legend's
 * pill, dropdown menus. Prefer `CARD_PLAIN`/`CARD_TINTED` when the thing really is a card.
 */
export { CARD_SHADOW };
