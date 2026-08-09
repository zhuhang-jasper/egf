/**
 * Shared surface for the page-level toolbar controls in both tabs. Shared rather than inlined because the
 * two toolbars occupy the same position on the page, so any drift reads as the chrome changing on switch.
 *
 * Surface only: layout, transition and the focus ring come from `buttonVariants`, so this composes onto a
 * `<Button>` rather than replacing what it provides.
 */
export const TOOLBAR_SURFACE = "shrink-0 border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900";

/**
 * The 32px square icon-only variant: {@link TOOLBAR_SURFACE} plus the `rounded-lg` that a `size="icon"`
 * button wants. Labelled buttons take their own radius from `shape` (e.g. `pill`) instead.
 */
export const TOOLBAR_ICON_SURFACE = `${TOOLBAR_SURFACE} rounded-lg`;
