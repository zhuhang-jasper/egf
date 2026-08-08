import { getChartSecondaryLabelSizePx } from "@/chart/fonts";
import { FE_UI, normalizeAttachedBadge, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";

/**
 * `matchHeightPx` (md only) MAKES THE PILL TAKE A HEIGHT IT IS GIVEN rather than deriving its own from its
 * font and padding. It exists for the chart title row, where the badge sits beside the chart title: the title
 * is the primary content there and should set the row's height, with the pill sizing itself to match.
 *
 * The font size is deliberately NOT part of this — it stays on the chart's secondary scale, the same one the
 * cluster legend uses, so the badge still reads as chrome belonging to the chart rather than as a second
 * title. Only the BOX follows the title; the text inside it does not grow.
 *
 * Vertical padding is dropped when this is set. Everything is `border-box`, so an explicit height already
 * wins over padding and keeping both would just be two sources for one number. `items-center` on the pill is
 * what then centres the label's LINE BOX in whatever height it was handed.
 *
 * CENTRING THE LINE BOX IS NOT THE SAME AS CENTRING THE INK, which is why the sm pill sets `leading-[1.4]`
 * rather than the `leading-none` it used to share with md. At `line-height: 1` the line box is exactly the
 * font size and there is no half-leading to balance the glyph inside it, so the ink lands wherever the font's
 * ascent/descent metrics put it. For the all-caps, descender-free "FE"/"BE" that is high in the box, leaving
 * a sliver of dead space below — visible as text sitting off-centre in the pill, and worse on mobile where
 * `system-ui` resolves to a font with different metrics than the desktop one. A line-height above 1 restores
 * the symmetric half-leading that centres the ink; the padding then sits on a box that is already balanced.
 *
 * sm IS md AT A SMALLER FONT — every proportion is md's, so the chart pill reads as the toolbar pill enlarged
 * rather than as a second design. md is the reference because its size is pinned to the chart (see below), so
 * it is the one that cannot move. The shared ratios, all against font size:
 *
 *   height  1.8x   md is `labelPx + 2 * round(labelPx * 0.4)`; sm is a 1.4 line box + 2px, both 18px at 10px
 *   pad-x   0.85em stated as `em` so it scales with sm's font instead of being pre-multiplied to px
 *   min-w   2.75em `trackBadgeMdMinWidthEm`, so "FE" and "BE" are one width at both sizes
 *
 * These were NOT all shared before, and the gap was visible: sm had 0.6x side padding against md's 0.85x, so
 * the toolbar pill read as squarer and shorter while matching md's height exactly. sm also carried
 * `tracking-wide`, which md does not, widening the label inside an already-narrower box. Both are gone.
 * Changing the leading means re-deriving the padding, since the two together are what hold the height ratio.
 *
 * md keeps `leading-none` deliberately: its height comes from `matchHeightPx` (or the padding mirrored in
 * chart/fonts.js `getTrackBadgeMdHeightPx`), and a line box taller than the font size would fight that
 * measurement. Its glyphs are centred by the flex box instead, in a height that was computed for them.
 */
export function TrackBadge({ variant, className, size = "sm", hidden = false, chartWidth = 0, matchHeightPx = 0 }) {
  const badge = normalizeAttachedBadge(variant);
  // `none` = no attached badge; render nothing so untracked charts/profiles show no pill.
  if (badge === "none") {
    return null;
  }
  const ui = TRACK_BADGE_UI[badge];
  const isLarge = size === "md";
  const scaledLabelPx = getChartSecondaryLabelSizePx(chartWidth || FE_UI.page.minWidthPx);
  const scaledBadgeStyle = isLarge
    ? {
        fontSize: scaledLabelPx,
        minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em`,
        paddingLeft: Math.round(scaledLabelPx * 0.85),
        paddingRight: Math.round(scaledLabelPx * 0.85),
        ...(matchHeightPx
          ? { height: matchHeightPx }
          : {
              paddingTop: Math.round(scaledLabelPx * 0.4),
              paddingBottom: Math.round(scaledLabelPx * 0.4),
            }),
        borderRadius: Math.min(6, Math.max(4, Math.round(scaledLabelPx * 0.42))),
      }
    : // sm takes the SAME min-width as md, in `em` so it resolves against sm's own smaller font. This is
      // what stops "FE" and "BE" rendering at two different widths, and it is the last of md's proportions
      // that sm did not already share.
      { minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em` };

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center",
        isLarge
          ? "justify-center font-bold leading-none"
          : "justify-center rounded px-[0.85em] py-[2px] text-[10px] font-semibold leading-[1.4]",
        !isLarge && "font-medium",
        ui.pillClass,
        hidden && "invisible pointer-events-none",
        className,
      )}
      style={scaledBadgeStyle}
      aria-hidden={hidden || undefined}
    >
      {ui.shortLabel}
    </span>
  );
}
