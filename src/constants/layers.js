/**
 * The app's stacking order, in one place. Import these instead of writing a bare `z-*` class, so a new
 * overlay cannot be layered by guessing against whatever the neighbouring component happened to pick.
 *
 * The rule that makes the numbers work: an overlay's `z-*` only competes inside its nearest ancestor
 * STACKING CONTEXT. A positioned ancestor with its own `z-index` caps everything within it, so a `z-50`
 * dropdown nested in a `z-[2]` toolbar still loses to a `z-10` sibling of that toolbar. Overlay layers below
 * therefore only hold if no ancestor between the overlay and <body> sets a z-index. Ancestors on the path to a
 * dropdown use `relative` with NO z-index (which paints above static siblings without trapping descendants);
 * `LAYER.chrome` on the header/nav is safe because neither contains an overlay.
 */
export const LAYER = {
  /** Sticky header and fixed bottom nav. Page content scrolls under them. */
  chrome: "z-40",
  /** Dropdown menus, popovers, comboboxes. Above chrome: only one is ever open, so they cannot fight. */
  dropdown: "z-[80]",
  /** Modal dialogs and the install banner. */
  modal: "z-[100]",
  /** Toasts win over everything, including an open dropdown or modal. */
  toast: "z-[120]",
};

// `dropdown` sits below `modal`, which is fine for a dropdown INSIDE a dialog: the dialog's overlay is a
// stacking context, so the menu is ordered within it and the two numbers never meet. They are only compared for
// a dropdown outside a dialog, where losing to the scrim is right. A dropdown portaled out of a dialog would
// need its own layer above `modal`.

/**
 * Tooltips deliberately sit BELOW dropdowns and toasts, and are bounded to the content area (Floating UI
 * collision padding keeps them off the header). Kept out of `LAYER` because it is not a free choice: a
 * tooltip is attached to a trigger, so it must lose to any overlay that could cover that trigger.
 */
export const TOOLTIP_LAYER = "z-50";
