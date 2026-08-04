/**
 * The shared look of the page-level toolbar controls that sit above the content in both tabs — the
 * theory tab's print/share icons and the tool tab's copy/share buttons.
 *
 * WHY A CONSTANT AND NOT INLINE CLASSES. The two tabs' toolbars occupy the same position on the page and
 * the user switches between them, so any drift between the two reads as the chrome changing under them.
 * These were separate class lists once and had already diverged (one muted-slate, one default `outline`
 * button) before they were pulled together here.
 *
 * SURFACE ONLY — radius, border, fill, text and hover colours. Layout, transition and the focus-visible
 * ring come from `buttonVariants`, so these compose onto a `<Button>` at any size or shape rather than
 * replacing what it already provides.
 */
export const TOOLBAR_SURFACE = "shrink-0 border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900";

/**
 * The 32px square icon-only variant: {@link TOOLBAR_SURFACE} plus the `rounded-lg` that a `size="icon"`
 * button wants. Labelled buttons take their own radius from `shape` (e.g. `pill`) instead.
 */
export const TOOLBAR_ICON_SURFACE = `${TOOLBAR_SURFACE} rounded-lg`;
