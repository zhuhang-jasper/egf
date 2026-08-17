/**
 * Shared surface for the page-level toolbar controls in both tabs. Shared rather than inlined because the
 * two toolbars occupy the same position on the page, so any drift reads as the chrome changing on switch.
 *
 * Surface only: layout, transition and the focus ring come from `buttonVariants`, so this composes onto a
 * `<Button>` rather than replacing what it provides.
 */
/*
 * WHITE, NOT A SLATE TINT. These used to be `bg-slate-100/80`, which read as a raised control only because the
 * page behind it was white — a tint on white is a button; the same tint on a tinted page is camouflage. The
 * page now carries the tint (see `--color-page-base`), so the buttons take the surface colour instead and the
 * figure/ground relationship is the same one it always was, just the right way round.
 *
 * Hover DARKENS toward the page rather than lightening: at rest these are the lightest thing in the row, so
 * there is nowhere lighter to go.
 */
export const TOOLBAR_SURFACE = "shrink-0 border-slate-200 bg-page-surface text-slate-600 hover:bg-slate-100 hover:text-slate-900";

/**
 * The 32px square icon-only variant: {@link TOOLBAR_SURFACE} plus the `rounded-lg` that a `size="icon"`
 * button wants. Labelled buttons take their own radius from `shape` (e.g. `pill`) instead.
 */
export const TOOLBAR_ICON_SURFACE = `${TOOLBAR_SURFACE} rounded-lg`;
