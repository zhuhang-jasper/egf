import { describe, expect, it } from "vitest";

import { computePopoverLayout } from "@/utils/popover-layout";

// Row heights are 40 throughout so the expected numbers are readable: with `listChrome` 8, a 6.5-row cap is
// 6.5 * 40 + 8 = 268, comfortable (4.5) is 188, and the floor (2.5) is 108.
const ROWS = { visible: 6.5, comfortable: 4.5, min: 2.5 };
// 10 rows of 40px, an 8px list chrome and a 36px search box, unless a case overrides one.
const m = (over) => ({ spaceBelow: 600, spaceAbove: 600, searchH: 36, rowH: 40, listChrome: 8, naturalListH: 408, ...over });
const layout = (over, rows = ROWS) => computePopoverLayout(m(over), rows);

describe("direction", () => {
  // Room for the comfortable height below (188 + 36 = 224), so it opens down whatever is above.
  it("opens down when there is room", () => {
    expect(layout({ spaceBelow: 300, spaceAbove: 600 }).up).toBe(false);
  });
  it("flips up when below cannot hold the floor", () => {
    expect(layout({ spaceBelow: 100, spaceAbove: 600 }).up).toBe(true);
  });
  // DIRECTION IS DECIDED AGAINST THE COMFORTABLE HEIGHT, NOT THE IDEAL: 224 fits in 240 even though the full
  // list (408 + 36) does not, so this stays down rather than flipping to show more.
  it("a sufficient height keeps it down", () => {
    expect(layout({ spaceBelow: 240, spaceAbove: 600 }).up).toBe(false);
  });
  it("stays down when above is no better", () => {
    expect(layout({ spaceBelow: 100, spaceAbove: 100 }).up).toBe(false);
  });
  it("stays down when above is worse", () => {
    expect(layout({ spaceBelow: 100, spaceAbove: 50 }).up).toBe(false);
  });
});

describe("list height", () => {
  it("a short list needs no cap", () => {
    expect(layout({ naturalListH: 120 }).listMaxHeight).toBeNull();
  });
  it("a long list caps at the peek height", () => {
    expect(layout({ naturalListH: 1000 }).listMaxHeight).toBe(268);
  });
  // Space binds before the peek cap does: 300 available - 36 search = 264.
  it("a tight band caps below the peek", () => {
    expect(layout({ spaceBelow: 300, naturalListH: 1000 }).listMaxHeight).toBe(264);
  });
});

describe("the floor overlaps chrome", () => {
  // THE FLOOR MAY EXCEED THE BAND. 100 - 36 = 64 is under the 108 floor, so the floor wins and the panel
  // overlaps the chrome rather than collapsing to a search box with nothing under it.
  it("the floor beats a band too small to hold it", () => {
    expect(layout({ spaceBelow: 100, spaceAbove: 100, naturalListH: 1000 }).listMaxHeight).toBe(108);
  });
  it("the floor applies flipped up too", () => {
    expect(layout({ spaceBelow: 40, spaceAbove: 100, naturalListH: 1000 }).listMaxHeight).toBe(108);
  });
});

describe("nothing to measure yet", () => {
  // rowH 0 is the first pass, before a row has been laid out, so space decides alone and the floor is 0.
  // Both sides equal so the direction cannot change which space is read: 300 - 36 = 264.
  it("rowH 0 lets the space decide", () => {
    expect(layout({ rowH: 0, spaceBelow: 300, spaceAbove: 300, naturalListH: 1000 }).listMaxHeight).toBe(264);
  });
  it("rowH 0 still reports a direction", () => {
    expect(layout({ rowH: 0, spaceBelow: 100, spaceAbove: 600 }).up).toBe(true);
  });
  it("an empty list needs no cap", () => {
    expect(layout({ rowH: 0, naturalListH: 0, spaceBelow: 10 }).listMaxHeight).toBeNull();
  });
});

describe("the row counts are the knobs", () => {
  // Same measurements, a larger visible cap: 8.5 * 40 + 8 = 348.
  it("the visible cap moves with its knob", () => {
    expect(layout({ naturalListH: 1000 }, { ...ROWS, visible: 8.5 }).listMaxHeight).toBe(348);
  });
  it("the comfortable count moves the flip point", () => {
    expect(layout({ spaceBelow: 240, spaceAbove: 600 }, { ...ROWS, comfortable: 6.5 }).up).toBe(true);
  });
});
