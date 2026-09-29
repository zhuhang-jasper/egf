/**
 * Direction and list height for the profile dropdown. Measurements arrive as plain numbers and the row counts
 * as parameters; the caller does the measuring.
 * See docs/DECISIONS.md#profile-dropdown-sizing-and-direction
 */

/**
 * `m` holds the measured px: the space each side (gaps already deducted), the search box and row heights, the
 * list box's own chrome, and the list's unconstrained height. `rowH` is 0 before a row has been laid out.
 * Returns `listMaxHeight: null` when the list fits and needs no cap.
 */
export function computePopoverLayout(m, rows) {
  const { spaceBelow, spaceAbove, searchH, rowH, listChrome, naturalListH } = m;

  // With no row to measure, a row-count cap is meaningless: Infinity lets the space decide alone rather than
  // pinning the panel to a height derived from 0.
  const cap = (count) => (rowH > 0 ? Math.round(count * rowH + listChrome) : Infinity);

  // Direction is decided against a SUFFICIENT height, not the ideal one, so a menu that could show a few rows
  // below does not flip over the input to show more.
  const neededHeight = searchH + Math.min(naturalListH, cap(rows.comfortable));
  const up = neededHeight > spaceBelow && spaceAbove > spaceBelow;
  const available = Math.floor(up ? spaceAbove : spaceBelow);

  // The floor may EXCEED the available band: past it the panel overlaps chrome rather than collapsing to a
  // search box with nothing under it. `rowH` of 0 makes the floor 0, since there is nothing to hold open for.
  const minListH = rowH > 0 ? Math.round(rows.min * rowH + listChrome) : 0;
  const listCap = Math.min(cap(rows.visible), Math.max(minListH, available - searchH));
  return { up, listMaxHeight: naturalListH <= listCap ? null : listCap };
}
