/**
 * verify-popover-layout.mjs
 *
 * Fixture table for src/utils/popover-layout.js: which way the profile dropdown opens, and how tall its list
 * is allowed to get. Pure input → output, no DOM, because the function takes its measurements as numbers —
 * the caller in ProfileCombobox does the measuring.
 *
 * Row heights are 40 throughout so the expected numbers are readable: with `listChrome` 8, a 6.5-row cap is
 * 6.5 * 40 + 8 = 268, comfortable (4.5) is 188, and the floor (2.5) is 108.
 *
 * Usage: node scripts/verify-popover-layout.mjs
 *
 * Exits 0 when every case passes, 1 on the first failing run (all failures are printed first).
 */

import { computePopoverLayout } from "../src/utils/popover-layout.js";

const results = [];

function check(name, actual, expected) {
  results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
}

const ROWS = { visible: 6.5, comfortable: 4.5, min: 2.5 };
// 10 rows of 40px, an 8px list chrome and a 36px search box, unless a case overrides one.
const m = (over) => ({ spaceBelow: 600, spaceAbove: 600, searchH: 36, rowH: 40, listChrome: 8, naturalListH: 408, ...over });
const layout = (over, rows = ROWS) => computePopoverLayout(m(over), rows);

// --- direction ---------------------------------------------------------------
// Room for the comfortable height below (188 + 36 = 224), so it opens down whatever is above.
check("opens down when there is room", layout({ spaceBelow: 300, spaceAbove: 600 }).up, false);
// The floor no longer fits below and above is roomier, so it flips.
check("flips up when below cannot hold the floor", layout({ spaceBelow: 100, spaceAbove: 600 }).up, true);
// DIRECTION IS DECIDED AGAINST THE COMFORTABLE HEIGHT, NOT THE IDEAL: 224 fits in 240 even though the full
// list (408 + 36) does not, so this stays down rather than flipping to show more.
check("a sufficient height keeps it down", layout({ spaceBelow: 240, spaceAbove: 600 }).up, false);
// Cramped on both sides, and above is no better: stay down and squeeze.
check("stays down when above is no better", layout({ spaceBelow: 100, spaceAbove: 100 }).up, false);
check("stays down when above is worse", layout({ spaceBelow: 100, spaceAbove: 50 }).up, false);

// --- list height -------------------------------------------------------------
// The whole list fits inside the 6.5-row cap's space, so no cap is imposed at all.
check("a short list needs no cap", layout({ naturalListH: 120 }).listMaxHeight, null);
// Plenty of room, so the peek cap binds: 6.5 rows + chrome.
check("a long list caps at the peek height", layout({ naturalListH: 1000 }).listMaxHeight, 268);
// Space binds before the peek cap does: 300 available - 36 search = 264.
check("a tight band caps below the peek", layout({ spaceBelow: 300, naturalListH: 1000 }).listMaxHeight, 264);

// --- the floor overlaps chrome ----------------------------------------------
// THE FLOOR MAY EXCEED THE BAND. 100 - 36 = 64 is under the 108 floor, so the floor wins and the panel
// overlaps the chrome rather than collapsing to a search box with nothing under it.
check("the floor beats a band too small to hold it", layout({ spaceBelow: 100, spaceAbove: 100, naturalListH: 1000 }).listMaxHeight, 108);
check("the floor applies flipped up too", layout({ spaceBelow: 40, spaceAbove: 100, naturalListH: 1000 }).listMaxHeight, 108);

// --- nothing to measure yet --------------------------------------------------
// rowH 0 is the first pass, before a row has been laid out. No row-count cap is meaningful, so space decides
// alone and the floor is 0 rather than a height derived from a 0-px row. Both sides equal here so the
// direction cannot change which space is read: 300 - 36 = 264.
check("rowH 0 lets the space decide", layout({ rowH: 0, spaceBelow: 300, spaceAbove: 300, naturalListH: 1000 }).listMaxHeight, 264);
check("rowH 0 still reports a direction", layout({ rowH: 0, spaceBelow: 100, spaceAbove: 600 }).up, true);
// An empty list has nothing to cap even with no room.
check("an empty list needs no cap", layout({ rowH: 0, naturalListH: 0, spaceBelow: 10 }).listMaxHeight, null);

// --- the row counts are the knobs -------------------------------------------
// Same measurements, a larger visible cap: 8.5 * 40 + 8 = 348.
check("the visible cap moves with its knob", layout({ naturalListH: 1000 }, { ...ROWS, visible: 8.5 }).listMaxHeight, 348);
// A larger comfortable count needs more room below, so the same band now flips.
check("the comfortable count moves the flip point", layout({ spaceBelow: 240, spaceAbove: 600 }, { ...ROWS, comfortable: 6.5 }).up, true);

const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.error(`FAIL  ${r.name}\n        expected ${JSON.stringify(r.expected)}\n        actual   ${JSON.stringify(r.actual)}`);
}
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
