import { describe, expect, it } from "vitest";

import { badgeRank, sortProfilesForPicker } from "@/utils/profile-picker-sort";

// Mirrors the app's BADGE_SORT_ORDER: real badges in badge-dropdown order, "none" last.
const ORDER = ["fe", "be", "none"];
const norm = (b) => (b === "fe" || b === "be" ? b : "none");
const opts = { badgeOrder: ORDER, normalizeBadge: norm };

const titles = (rows) => rows.map((r) => r.title);
const p = (title, attachedBadge = "none") => ({ title, attachedBadge });
const sorted = (rows, extra) => titles(sortProfilesForPicker(rows, { ...opts, ...extra }));

describe("badgeRank", () => {
  it("first badge ranks 0", () => {
    expect(badgeRank("fe", ORDER)).toBe(0);
  });
  it("second badge ranks 1", () => {
    expect(badgeRank("be", ORDER)).toBe(1);
  });
  it("none ranks last", () => {
    expect(badgeRank("none", ORDER)).toBe(2);
  });
  // An unknown badge must not rank AHEAD of the real ones, or a corrupt row jumps the list.
  it("an unknown badge ranks past the end", () => {
    expect(badgeRank("wat", ORDER)).toBe(3);
  });
});

describe("grouping", () => {
  it("badge group wins over the name", () => {
    expect(sorted([p("Alpha"), p("Zeta", "fe")])).toEqual(["Zeta", "Alpha"]);
  });
  it("groups run fe, be, then none", () => {
    expect(sorted([p("C"), p("B", "be"), p("A", "fe")])).toEqual(["A", "B", "C"]);
  });
  it("an unknown badge sorts with none", () => {
    expect(sorted([p("B", "wat"), p("A", "fe")])).toEqual(["A", "B"]);
  });
});

describe("alphabetical within a group", () => {
  it("A-Z within one group", () => {
    expect(sorted([p("c"), p("a"), p("b")])).toEqual(["a", "b", "c"]);
  });
  it("case does not split the alphabet", () => {
    expect(sorted([p("beta"), p("Alpha")])).toEqual(["Alpha", "beta"]);
  });
  // `sensitivity: "base"` is what groups accents with their base letter instead of after z.
  it("accents group with the base letter", () => {
    expect(sorted([p("Zoe"), p("ánna")])).toEqual(["ánna", "Zoe"]);
  });
});

describe("filtering", () => {
  it("an empty query keeps every row", () => {
    expect(sorted([p("a"), p("b")])).toEqual(["a", "b"]);
  });
  it("the query is a substring match", () => {
    expect(sorted([p("Alpha"), p("Beta")], { query: "et" })).toEqual(["Beta"]);
  });
  it("the query is case-insensitive", () => {
    expect(sorted([p("Alpha")], { query: "ALPH" })).toEqual(["Alpha"]);
  });
  // Whitespace-only input is a user mid-type, not a filter that should empty the list.
  it("a whitespace query keeps every row", () => {
    expect(sorted([p("a"), p("b")], { query: "   " })).toEqual(["a", "b"]);
  });
  it("no match returns empty", () => {
    expect(sorted([p("Alpha")], { query: "zzz" })).toEqual([]);
  });
});

describe("robustness", () => {
  it("a null list is empty, not a throw", () => {
    expect(sorted(null)).toEqual([]);
  });
  it("an absent badge field sorts as none", () => {
    expect(sorted([{ title: "A" }])).toEqual(["A"]);
  });
  // Sorting must not reorder the caller's array: `profiles` is store state.
  it("the input array is left untouched", () => {
    const input = [p("c"), p("a")];
    sortProfilesForPicker(input, opts);
    expect(titles(input)).toEqual(["c", "a"]);
  });
});
