/**
 * verify-profile-picker-sort.mjs
 *
 * Fixture table for src/utils/profile-picker-sort.js: which order the profile dropdown's rows come out in.
 * Pure input → output, no DOM and no store, because the badge order arrives as a parameter rather than being
 * imported — the same injection that lets verify-profile-stamp.mjs run under bare node.
 *
 * Usage: node scripts/verify-profile-picker-sort.mjs
 *
 * Exits 0 when every case passes, 1 on the first failing run (all failures are printed first).
 */

import { badgeRank, sortProfilesForPicker } from "../src/utils/profile-picker-sort.js";

const results = [];

function check(name, actual, expected) {
  results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
}

// Mirrors the app's BADGE_SORT_ORDER: real badges in badge-dropdown order, "none" last.
const ORDER = ["fe", "be", "none"];
const norm = (b) => (b === "fe" || b === "be" ? b : "none");
const opts = { badgeOrder: ORDER, normalizeBadge: norm };

const titles = (rows) => rows.map((r) => r.title);
const p = (title, attachedBadge = "none") => ({ title, attachedBadge });

// --- badgeRank ---------------------------------------------------------------
check("first badge ranks 0", badgeRank("fe", ORDER), 0);
check("second badge ranks 1", badgeRank("be", ORDER), 1);
check("none ranks last", badgeRank("none", ORDER), 2);
// An unknown badge must not rank AHEAD of the real ones, or a corrupt row jumps the list.
check("an unknown badge ranks past the end", badgeRank("wat", ORDER), 3);

// --- grouping ----------------------------------------------------------------
// Badge group beats the name: "Zeta (fe)" outranks "Alpha (none)" despite the alphabet.
check("badge group wins over the name", titles(sortProfilesForPicker([p("Alpha"), p("Zeta", "fe")], opts)), ["Zeta", "Alpha"]);
check("groups run fe, be, then none", titles(sortProfilesForPicker([p("C"), p("B", "be"), p("A", "fe")], opts)), ["A", "B", "C"]);
// A badge outside the order is normalized to "none" and so sorts into that group, not past it.
check("an unknown badge sorts with none", titles(sortProfilesForPicker([p("B", "wat"), p("A", "fe")], opts)), ["A", "B"]);

// --- alphabetical within a group ---------------------------------------------
check("A-Z within one group", titles(sortProfilesForPicker([p("c"), p("a"), p("b")], opts)), ["a", "b", "c"]);
// Case-insensitive, so a capitalised name does not sort ahead of every lowercase one.
check("case does not split the alphabet", titles(sortProfilesForPicker([p("beta"), p("Alpha")], opts)), ["Alpha", "beta"]);
// `sensitivity: "base"` is what groups accents with their base letter instead of after z.
check("accents group with the base letter", titles(sortProfilesForPicker([p("Zoe"), p("ánna")], opts)), ["ánna", "Zoe"]);

// --- filtering ---------------------------------------------------------------
check("an empty query keeps every row", titles(sortProfilesForPicker([p("a"), p("b")], opts)), ["a", "b"]);
check("the query is a substring match", titles(sortProfilesForPicker([p("Alpha"), p("Beta")], { ...opts, query: "et" })), ["Beta"]);
check("the query is case-insensitive", titles(sortProfilesForPicker([p("Alpha")], { ...opts, query: "ALPH" })), ["Alpha"]);
// Whitespace-only input is a user mid-type, not a filter that should empty the list.
check("a whitespace query keeps every row", titles(sortProfilesForPicker([p("a"), p("b")], { ...opts, query: "   " })), ["a", "b"]);
check("no match returns empty", titles(sortProfilesForPicker([p("Alpha")], { ...opts, query: "zzz" })), []);

// --- robustness --------------------------------------------------------------
check("a null list is empty, not a throw", titles(sortProfilesForPicker(null, opts)), []);
check("an absent badge field sorts as none", titles(sortProfilesForPicker([{ title: "A" }], opts)), ["A"]);
// Sorting must not reorder the caller's array: `profiles` is store state.
const input = [p("c"), p("a")];
sortProfilesForPicker(input, opts);
check("the input array is left untouched", titles(input), ["c", "a"]);

const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.error(`FAIL  ${r.name}\n        expected ${JSON.stringify(r.expected)}\n        actual   ${JSON.stringify(r.actual)}`);
}
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
