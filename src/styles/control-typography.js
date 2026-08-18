/**
 * Shared text ramp for the interactive chrome — buttons, inputs, dropdown rows. ONE STEP, AT `xs` (470px).
 *
 * `xs` IS `FE_UI.page.maxWidthPx`, the width the tool column caps at, and this chrome is overwhelmingly the tool
 * tab's. Past 470 the column, the chart and the chart's own type (`FE_UI.chart.secondaryLabelRungs`) are all
 * static, so a rung at `sm` (640) grew a control while everything beside it held still — and the chart's chrome
 * cannot follow to 640 anyway, because it is sized in JS for an export that renders off-screen at a pinned width
 * where media queries do not apply. Stepping here is what puts a control and the chart chrome beside it on the
 * same moment.
 *
 * A CONTROL'S SIZE IS A PROPERTY OF THE CONTROL, NOT OF THE PAGE IT SITS ON. That is why one ramp serves both
 * tabs even though their columns cap at different widths (tool 455, theory 900): a button is the same object
 * wherever it appears and should not resize because it happened to land on a wider page. The column's cap picks
 * the BREAKPOINT — `xs`, where the tool tab's own measure stops — but the ceiling of 13 is the control's, and it
 * applies everywhere.
 *
 * So the docs tab's prose out-scaling it is not a defect: `DOC_TEXT` steps at 640/768 for Theory's wider column
 * and reaches 14 where a control holds at 13. Within 1px, and exactly level at 640. A per-tab override was built
 * for this and removed — it made a shared primitive's size depend on its container, which is the thing this rule
 * exists to prevent.
 *
 * SIZE ONLY. Weight, colour and layout stay with the component, because these tokens land on surfaces
 * that disagree about all three (a menu row is muted and left-aligned, a primary button is neither).
 *
 * ONE RUNG, NOT TWO. There was a `CONTROL_TEXT_SM` a rung below this, for text deliberately secondary WITHIN a
 * control: the profile dropdown's search box (against the name field it hangs off) and its empty state. Both
 * moved onto `CONTROL_TEXT` — the search because it is paired with the option rows it filters rather than with
 * the field above it, the empty state because it stands exactly where those rows would be. That left the token
 * with no consumers, so it is gone. If a genuinely secondary control label turns up, reintroduce it at 11/12;
 * do not add a third rung, which would put two adjacent controls a single px apart.
 */
export const CONTROL_TEXT = "text-[12px] xs:text-[13px]";

/**
 * THE TOOL TAB'S TYPE RUNGS, one entry per job. Size only — weight, colour and tracking stay with the
 * component, for the reason `CONTROL_TEXT` above gives.
 *
 * Every rung steps once, at `xs` (470px), because that is where the tool column stops growing; see
 * `CONTROL_TEXT` for why that breakpoint and not `sm`. The rungs exist so the sizes are declared in ONE place
 * rather than inlined at a dozen call sites, which is how they drifted into 9/10/11/12/13/14/16/20 with no rule
 * anyone could state. Pick a rung by asking what the text DOES, not how big it should look:
 *
 *   display        the one number meant to dominate its card
 *   field          a form row and the input in it — one unit, so they share a rung
 *   `CONTROL_TEXT` anything interactive, plus a gloss sitting inside a field — declared above, not repeated
 *                  here, because the shared `ui/` primitives and the docs tab import it by that name
 *   label          text ABOUT something else: a cluster, a score, a badge, a nav item
 *   annotation     a note on the thing above it, and boxes whose `em` geometry needs the smaller font
 *
 * NO NEW RUNGS. Five already puts `label` and `CONTROL_TEXT` two px apart at base; a sixth would put two of them
 * one px apart, which reads as a mistake rather than a hierarchy. If something fits none of these, it is probably
 * a `label` — or the design wants revisiting, not the scale extending.
 *
 * The CHART's own chrome is deliberately absent. It scales continuously with the measured chart width (see
 * FE_UI.chart.titleRange and secondaryLabelRungs) because the PNG export renders off-screen at a pinned width
 * where media queries do not resolve, so it cannot use these classes at all.
 */
export const TOOL_TEXT = {
  /** Score card value. 14/18 — the largest type on the tab, and the only rung with a single consumer. */
  display: "text-[14px] xs:text-[18px]",
  /** Pillar row name + emoji, and LevelInput's value. Deliberately equal: the row and its input are one unit. */
  field: "text-[13px] xs:text-[14px]",
  /** Cluster label, score-card label, track badge (sm), bottom nav. */
  label: "text-[10px] xs:text-[12px]",
  /** Score-card sub-label, and BadgePicker's pill (its ~1.6em box needs the rung below to fit a row). */
  annotation: "text-[9px] xs:text-[11px]",
};
