import { useEffect, useLayoutEffect, useRef, useState } from "react";

// `Image` is aliased because the bare name is a global DOM constructor (`new Image()`), and a component
// shadowing it at module scope is a trap for anything later in this file that wants the real one.
import { Image as ImageIcon, Settings, Share2 } from "lucide-react";

import { AdminLockBadge } from "@/components/AdminLockBadge";
import { ChartScores } from "@/components/ChartScores";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";
import { useMiddleEllipsis } from "@/hooks/useMiddleEllipsis";

import { useAppStore } from "@/store/useAppStore";

import { getChartTitleSizePx, getTrackBadgeMdHeightPx } from "@/chart/fonts";
import {
  FE_UI,
  FEATURE_CHART_ATTRIBUTION_SETTING,
  FEATURE_CHART_LEGEND_SETTING,
  FEATURE_CHART_STRUCTURE_SETTINGS,
  FEATURE_CHART_UHD_EXPORT_SETTING,
  FEATURE_SCORES_SETTINGS,
  SITE_COPY,
} from "@/constants";
import { TOOLBAR_ICON_SURFACE, TOOLBAR_SURFACE } from "@/styles/toolbar";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { copyChartAsImageToClipboard, shareChartAsImage } from "@/utils/copy-chart-image";

// `adminOnly` is passed by the caller rather than read from the FEATURE_* constants here: those decide
// whether the row renders at all, and a row rendered under one flag but badged from another could disagree
// with itself. `select-none` because these rows get clicked repeatedly to flip a setting.
function DisplayCheckbox({ label, checked, onChange, adminOnly = false }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-1.5 text-xs hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-input accent-foreground"
      />
      {/* The one site that badges inline rather than at a corner, because a column of padlocks down a list of
          near-identical rows cannot be attributed to any of them. `static` switches AdminLockBadge out of its
          absolute default; `-translate-y-1` is a fixed nudge tied to its disc size, so re-judge it if that
          changes. `label=""` because the row's own `aria-label` is already the checkbox's accessible name. */}
      <span>
        {label}
        {adminOnly ? <AdminLockBadge label="" className="static ml-0.5 inline-flex -translate-y-1 align-middle" /> : null}
      </span>
    </label>
  );
}

function ChartDisplayMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const setChartLegendHidden = useAppStore((s) => s.setChartLegendHidden);
  const chartAttributionHidden = useAppStore((s) => s.chartAttributionHidden);
  const setChartAttributionHidden = useAppStore((s) => s.setChartAttributionHidden);
  const chartUhdExport = useAppStore((s) => s.chartUhdExport);
  const setChartUhdExport = useAppStore((s) => s.setChartUhdExport);
  const chartBadgeHidden = useAppStore((s) => s.chartBadgeHidden);
  const setChartBadgeHidden = useAppStore((s) => s.setChartBadgeHidden);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const setLevelsPolygonHidden = useAppStore((s) => s.setLevelsPolygonHidden);
  const chartLevelTicksHidden = useAppStore((s) => s.chartLevelTicksHidden);
  const setChartLevelTicksHidden = useAppStore((s) => s.setChartLevelTicksHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);
  const setChartTitleHidden = useAppStore((s) => s.setChartTitleHidden);
  const clusterLabelColors = useAppStore((s) => s.clusterLabelColors);
  const setClusterLabelColors = useAppStore((s) => s.setClusterLabelColors);
  const pillarEmojiHidden = useAppStore((s) => s.pillarEmojiHidden);
  const setPillarEmojiHidden = useAppStore((s) => s.setPillarEmojiHidden);
  const footerScoresHidden = useAppStore((s) => s.footerScoresHidden);
  const setFooterScoresHidden = useAppStore((s) => s.setFooterScoresHidden);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (!open) {
      return undefined;
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Chart display settings"
        onClick={() => setOpen((v) => !v)}
        className={cn(TOOLBAR_ICON_SURFACE, "group relative")}
      >
        <Settings className="h-4 w-4" />
        {/* Points down, into clear space — a top tooltip would render up into the sticky header
            (z-40) and get covered. */}
        {open ? null : <Tooltip text="Chart display settings" placement="bottom" />}
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Chart display settings"
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-max rounded-lg border border-border bg-card py-1 shadow-md"
        >
          <DisplayCheckbox label="Title" checked={!chartTitleHidden} onChange={(v) => setChartTitleHidden(!v)} />
          <DisplayCheckbox label="Badge" checked={!chartBadgeHidden} onChange={(v) => setChartBadgeHidden(!v)} />
          {/* `adminOnly` ON EVERY ROW INSIDE A FEATURE_* TEST, and only on those — the flag and the gate are the
              same decision written twice, once to decide whether the row exists and once to mark it. Adding a
              row here means setting both. */}
          {FEATURE_CHART_STRUCTURE_SETTINGS ? (
            <>
              <DisplayCheckbox adminOnly label="Chart" checked={!levelsPolygonHidden} onChange={(v) => setLevelsPolygonHidden(!v)} />
              <DisplayCheckbox adminOnly label="Level labels" checked={!chartLevelTicksHidden} onChange={(v) => setChartLevelTicksHidden(!v)} />
            </>
          ) : null}
          {FEATURE_CHART_LEGEND_SETTING ? (
            <DisplayCheckbox adminOnly label="Legend" checked={!chartLegendHidden} onChange={(v) => setChartLegendHidden(!v)} />
          ) : null}
          {/* EXPORT-ONLY ROWS, unlike every other toggle in this menu: neither the credit line nor the export
              resolution is anything on screen, so these change the copied/shared PNG and nothing the user is
              looking at. Both are labelled for the image rather than the chart for that reason. */}
          {FEATURE_CHART_ATTRIBUTION_SETTING ? (
            <DisplayCheckbox
              adminOnly
              label="Attribution on export"
              checked={!chartAttributionHidden}
              onChange={(v) => setChartAttributionHidden(!v)}
            />
          ) : null}
          {FEATURE_CHART_UHD_EXPORT_SETTING ? (
            <DisplayCheckbox adminOnly label="UHD export (4x)" checked={chartUhdExport} onChange={setChartUhdExport} />
          ) : null}
          {/* Appearance of the pillar labels themselves, as opposed to the show/hide toggles above. */}
          <hr className="my-1 border-t border-border" />
          <DisplayCheckbox label="Colored pillar labels" checked={clusterLabelColors} onChange={setClusterLabelColors} />
          <DisplayCheckbox label="Pillar emoji" checked={!pillarEmojiHidden} onChange={(v) => setPillarEmojiHidden(!v)} />
          {FEATURE_SCORES_SETTINGS ? (
            <DisplayCheckbox adminOnly label="Scores" checked={!footerScoresHidden} onChange={(v) => setFooterScoresHidden(!v)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Whether the Web Share API can share FILES here, probed with a dummy file because `canShare` gates on the
 * payload specifically. Computed once. Deliberately stricter than TheoryContent's CAN_SHARE_LINK: see
 * docs/DECISIONS.md#share-gates-are-deliberately-asymmetric.
 */
const CAN_SHARE_FILES = (() => {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof File !== "function") {
      return false;
    }
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
})();

/**
 * Image-export controls. "Copy image" is always shown (clipboard, falling back to a download); "Share"
 * appears only where the Web Share API can carry files. Share comes first, being the primary action where
 * it exists.
 *
 * Both take the theory tab's toolbar surface (see styles/toolbar.js) rather than a default button, so
 * switching tabs does not restyle the chrome. They keep their text because neither glyph is
 * self-explanatory: a plain `Image` deliberately makes no claim about the verb, since this button has two
 * possible outcomes and the earlier `ImageDown` advertised the fallback rather than the primary path.
 */
function ExportMenu({ onCopy, onShare }) {
  return (
    // `gap-2` IS SHARED WITH THEORY'S PRINT/SHARE GROUP (see TheoryContent's toolbar row) — same pills, same
    // place on the page, so the same 8px between them. Theory's was `gap-1.5`; keep the two in step. It
    // coincides with the parent row's `gap-2` but is not the same decision: that one spaces this group from
    // the display-settings gear at the far end, a different boundary — see the note on that row.
    <div className="flex min-w-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        onClick={onCopy}
        className={cn(TOOLBAR_SURFACE, "group relative gap-1")}
        aria-label="Copy image"
      >
        <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Copy
        <Tooltip text="Copy the chart image to your clipboard" />
      </Button>
      {CAN_SHARE_FILES ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          onClick={onShare}
          className={cn(TOOLBAR_SURFACE, "group relative gap-1")}
          aria-label="Share image"
        >
          <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Share
          <Tooltip text="Share the chart image" />
        </Button>
      ) : null}
    </div>
  );
}

export function ChartSection({ isVisible }) {
  const exportRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  // The invisible span inside the title that `useMiddleEllipsis` writes candidate strings into to measure them.
  const titleMeasureRef = useRef(null);
  const showToast = useAppStore((s) => s.showToast);

  const title = useAppStore((s) => s.title);
  const attachedBadge = useAppStore((s) => s.attachedBadge);
  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  // Read here only to hand to the export calls — it paints nothing on screen, so it is deliberately absent
  // from the relayout deps below.
  const chartAttributionHidden = useAppStore((s) => s.chartAttributionHidden);
  const chartUhdExport = useAppStore((s) => s.chartUhdExport);
  const chartBadgeHidden = useAppStore((s) => s.chartBadgeHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);
  const footerScoresHidden = useAppStore((s) => s.footerScoresHidden);

  // ONE observer on the frame, not two. The chart hook already watches this element to drive its fit,
  // and it publishes the width it measured — so the chrome that scales with the chart (title size,
  // track badge, cluster legend) reads that instead of adding a second ResizeObserver to the same box
  // and a second `offsetWidth` read per frame.
  const { chartRef, relayout, frameWidth: chartWidth } = useCompetencyChart(canvasRef, frameRef);

  const trimmedTitle = String(title).trim();
  // When the title is enabled but blank, show a muted placeholder on the chart (it also bakes into
  // the export) while the form input stays empty. The placeholder text lives in SITE_COPY.
  const titleIsBlank = trimmedTitle.length === 0;
  const displayTitle = titleIsBlank ? SITE_COPY.chartTitlePlaceholder : trimmedTitle;
  const showVisibleTitle = !chartTitleHidden;
  const showBadge = !chartBadgeHidden;
  const showTitleRow = showVisibleTitle || showBadge;
  const layoutWidth = chartWidth || FE_UI.page.minWidthPx;
  const titleSizePx = getChartTitleSizePx(layoutWidth);
  // MIDDLE-ELLIPSIS THE TITLE so a long profile name stays on one line with both ends readable, rather than
  // wrapping (which grew the row and pushed the chart down) or being end-truncated by `truncate` (which eats
  // the part that usually tells two profiles apart). `isVisible` is passed through because the tool tab is
  // `display: none` when Theory is open and nothing can be measured there — see the hook.
  const fittedTitle = useMiddleEllipsis(titleMeasureRef, displayTitle, isVisible);
  // A function of chart width ALONE, never of what is currently in the row: the title and badge toggles are
  // independent, so the row must be the same height in all four combinations or toggling one moves the chart.
  // `max()` in CSS rather than JS so the `1.25em` term resolves `leading-tight` from the same font size in the
  // same layout pass, leaving no JS mirror of the ratio to drift. See docs/DECISIONS.md#chart-type-scale.
  const titleRowMinHeight = `max(1.25em, ${getTrackBadgeMdHeightPx(layoutWidth)}px)`;

  useLayoutEffect(() => {
    if (isVisible) {
      relayout();
    }
  }, [isVisible, relayout]);

  useEffect(() => {
    relayout();
  }, [chartTitleHidden, chartBadgeHidden, chartLegendHidden, relayout]);

  const handleCopy = async () => {
    try {
      const result = await copyChartAsImageToClipboard({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
        profileName: title,
        attributionHidden: chartAttributionHidden,
        uhd: chartUhdExport,
      });
      if (result?.method === "clipboard") {
        track("chart_copied", { method: "clipboard" });
        showToast("Copied to clipboard", { variant: "success" });
      } else if (result?.method === "download") {
        track("chart_copied", { method: "download" });
        showToast("Image saved", { variant: "success" });
      } else {
        showToast("Couldn't copy the image", { variant: "error" });
      }
    } catch (e) {
      console.error(e);
      showToast("Couldn't copy the image", { variant: "error" });
    }
  };

  const handleShare = async () => {
    try {
      const result = await shareChartAsImage({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
        profileName: title,
        attributionHidden: chartAttributionHidden,
        uhd: chartUhdExport,
      });
      if (result?.method === "share") {
        // Native share sheet opened — completion is out of our hands, so don't claim success.
        track("chart_shared", { method: "share" });
      } else if (result?.method === "share-fallback-clipboard") {
        track("chart_shared", { method: "fallback-clipboard" });
        showToast("Copied — paste it to share", { variant: "success" });
      } else if (result?.method === "share-fallback-download") {
        track("chart_shared", { method: "fallback-download" });
        showToast("Image saved", { variant: "success" });
      } else {
        showToast("Couldn't share the image", { variant: "error" });
      }
    } catch (e) {
      console.error(e);
      showToast("Couldn't share the image", { variant: "error" });
    }
  };

  /* NO `gap` ON THIS COLUMN. The 16px under the toolbar used to be split across two classes — this column's
     `gap-2` plus the row's own `mb-2` — which was described as matching how the theory tab expresses the same
     space. It no longer was: theory's toolbar became a sibling of its sections column (dropping the `-mb-2`
     hack it needed while inside it), so that side is a single `mb-4` and there is no gapped column at all.
     The totals agreed while the construction did not, so comparing the two tabs meant adding two numbers on
     one side only. The whole 16px is now the row's own `mb-4`, the same class theory uses. */
  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      {/* `mb-4` is 16px below this toolbar, in one class. Theory's changelog row is the same row at the same
          position in the other tab and carries the same `mb-4` — keep the two in step, or the page appears to
          shift when you switch tabs. (The `gap-2` in this row's own class list is unrelated: that one spaces
          its buttons horizontally, and is matched to theory's button group separately.)

          IT OWNS THE SPACING OUTRIGHT, which is why the parent column has no `gap`: with the margin here, the
          space below the toolbar is one number in one place rather than a sum of two, and it cannot be changed
          by adding a third child to that column. It also sits OUTSIDE `exportRef`, so it cannot reach the image.

          `print:hidden` for the same reason theory's row carries it: these buttons only exist to be
          clicked, and "Copy image" on paper is nonsense. The chart below is the thing being printed.

          `justify-between` PINS ONE GROUP TO EACH END — the export actions at the left, the display-settings
          gear at the right — which is the same division theory's toolbar makes (page actions left, changelog
          right). Everything used to be bunched at the right together, so the gear (a settings control) read as
          a third export button. */}
      <div className="relative z-[2] mb-4 flex w-full min-w-0 items-center justify-between gap-2 print:hidden">
        <ExportMenu onCopy={handleCopy} onShare={handleShare} />
        <ChartDisplayMenu />
      </div>

      <div ref={exportRef} className="relative flex w-full min-w-0 flex-col self-stretch">
        {/* `fontSize` ON THE ROW IS WHAT THE `1.25em` FLOOR RESOLVES AGAINST — see `titleRowMinHeight`. The row
            carries the title's size so the browser can compute the same line box `leading-tight` will produce,
            without JS ever encoding the 1.25. The <h2> inside inherits it rather than setting its own, so there
            is exactly one place the size is applied.

            The old `leading-none` is gone: it existed to stop the row's own line box padding the height out
            while the height came from JS, and it would now fight the `em` floor by resolving against a
            different leading than the title's. Nothing else in the row renders bare text — the badge sets
            `leading-none` itself and the title carries `leading-tight`. */}
        {showTitleRow ? (
          <div
            data-chart-title-row
            className="relative z-[1] mb-3 flex w-full min-w-0 items-center gap-3"
            style={{ fontSize: titleSizePx, minHeight: titleRowMinHeight }}
          >
            {/* `matchHeightPx` IS WHAT MAKES THE BADGE FOLLOW THE TITLE rather than define the row, and it is
                UNCONDITIONAL — it does not check whether the title is currently shown. It was conditional, and
                that meant hiding the title also resized the pill beside it, so one toggle changed two things.
                The pill is now the same size in all four show/hide combinations, exactly like the row it sits
                in (see `titleRowHeightPx`).

                IT MATCHES THE TITLE'S FONT SIZE, NOT THE ROW HEIGHT. Matching the row would stretch the pill
                across the title's full leading, which at narrow widths is a 22px pill around an 11px label —
                visibly chunkier for no reason. The em box is the better target: the pill ends up the height of
                the title's letters, which is what the eye actually aligns it against, and it keeps the pill's
                height-to-label ratio close to where it already was (1.6x at the 350px floor). */}
            {showBadge ? (
              <TrackBadge variant={attachedBadge} size="md" className="shrink-0" chartWidth={chartWidth} matchHeightPx={titleSizePx} />
            ) : null}
            {showVisibleTitle ? (
              <h2
                id="competency-chart-heading"
                /* IDENTICAL TO THE THEORY TAB'S FRAMEWORK TITLE IN EVERY RESPECT BUT ALIGNMENT — same size
                   (both call getChartTitleSizePx with the same chart width), same `leading-tight`, weight,
                   tracking and color. Only `text-left` differs, because this one shares a row with the track
                   badge while theory's is centred over its radar. Keep the two in step; they are meant to read
                   as one piece of typography appearing in two places.

                   `leading-tight` RATHER THAN AN INLINE `lineHeight`, which is what this used to have (at a
                   slightly different 1.2). Two elements carrying the same utility class are the same by
                   construction; two elements computing a number in separate files are the same only until one
                   is edited — and the row's own floor is now `1.25em`, so nothing in JS has to know what this
                   class resolves to (see `titleRowMinHeight`).

                   NO `fontSize` OF ITS OWN: it inherits the row's, which is set to exactly this value. That is
                   what makes the row's `em` floor and this element's leading resolve against the same number
                   by construction rather than by both being handed it.

                   `truncate` IS NOT USED HERE and would be wrong: it ellipsises the END, and a profile name's
                   end is the part most likely to distinguish it ("… Engineer L4" vs "… L5"). The middle is cut
                   instead — see `useMiddleEllipsis` — which needs the text on ONE line, hence `whitespace-nowrap`
                   in place of the wrapping this used to do.

                   `title` CARRIES THE FULL NAME so the untruncated string is still reachable: a native tooltip
                   on hover, and the accessible name via `aria-label`, since what is rendered may be elided. */
                className={`relative m-0 min-w-0 flex-1 overflow-hidden text-left leading-tight tracking-tight whitespace-nowrap only:ml-2 ${titleIsBlank ? "text-slate-900/30 font-regular" : "text-slate-900 font-extrabold"}`}
                title={titleIsBlank ? undefined : displayTitle}
                aria-label={titleIsBlank ? undefined : displayTitle}
              >
                {/* THE MEASURING ELEMENT, and it is deliberately EMPTY as far as React is concerned. The fitting
                    loop writes candidate strings into it and reads `scrollWidth` back; React renders nothing
                    into it, so the two never fight over its contents (see the hook's note on `ref`).

                    It is `absolute` so it takes no space and cannot affect the row — but `left-0 right-0` keeps
                    it exactly as wide as this <h2>, which is the width the visible text is actually fitted
                    against. It inherits font, weight and tracking from the heading, so what it measures is the
                    same type that will be painted. `invisible` rather than `hidden`: it must still be laid out
                    to have a `scrollWidth` at all. */}
                <span ref={titleMeasureRef} aria-hidden className="pointer-events-none invisible absolute left-0 right-0 whitespace-nowrap" />
                {fittedTitle}
              </h2>
            ) : (
              <h2 id="competency-chart-heading" className="sr-only">
                Chart
              </h2>
            )}
          </div>
        ) : (
          <h2 id="competency-chart-heading" className="sr-only">
            Chart
          </h2>
        )}

        {/* `data-chart-frame` marks the box whose height the fit sets. The ref identifies it here, but refs do
            not survive `cloneNode`, and the off-screen export clone has to find this same element to run the
            fit against — see utils/export-clone.js. */}
        <div
          ref={frameRef}
          data-chart-frame
          className="relative z-0 mx-auto w-full max-w-full box-border"
          style={{ minHeight: FE_UI.chartFrame.minChartHeightPx }}
        >
          <div className="absolute inset-0 min-h-0 min-w-0">
            <canvas ref={canvasRef} id="competencyChart" data-radar-canvas aria-labelledby="competency-chart-heading" />
          </div>
        </div>

        {!chartLegendHidden ? (
          <div
            data-chart-export="chart-legend-card"
            className="mx-auto mt-3 flex w-fit max-w-full items-center justify-center rounded-lg border border-border bg-muted px-6 py-2.5 leading-none"
          >
            <ClusterLegend chartWidth={chartWidth} />
          </div>
        ) : null}

        {FEATURE_SCORES_SETTINGS && !footerScoresHidden ? (
          <div data-chart-export="chart-scores" className="mt-3 flex flex-col gap-2 xs:gap-3" aria-label="Cluster averages and score summary">
            <ChartScores />
          </div>
        ) : null}
      </div>
    </div>
  );
}
