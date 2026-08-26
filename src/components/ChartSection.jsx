import { useEffect, useLayoutEffect, useRef } from "react";

import { ChartScores } from "@/components/ChartScores";
import { ChartDisplayMenu, ExportMenu } from "@/components/ChartToolbar";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";
import { useMiddleEllipsis } from "@/hooks/useMiddleEllipsis";

import { CHART_EXPORT_TOAST_KEY, selectExportFrameworkVersion, useAppStore } from "@/store/useAppStore";

import { getChartTitleSizePx } from "@/chart/fonts";
import { FE_UI, FEATURE_SCORES_SETTINGS, SITE_COPY } from "@/constants";
import { CARD_PLAIN } from "@/styles/card";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { copyChartAsImageToClipboard, shareChartAsImage } from "@/utils/copy-chart-image";
import { resolveExportOutcome } from "@/utils/export-outcome";

/**
 * The title row's leading, mirroring Tailwind's `leading-tight` on the <h2> inside it.
 *
 * Duplicated in JS rather than left to CSS because the row must reserve its height whether or not the title is
 * rendered: with the title hidden there is no line box to derive it from. If `leading-tight` on the <h2>
 * changes, change this with it.
 */
const TITLE_ROW_LEADING = 1.25;

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
  // The version the exported credit names. The loaded profile's own stamp where there is one (an unsaved clone
  // included — see duplicateDraft), so the PNG says what these numbers were rated against; the current version
  // for a plain draft, which is being rated now. Export-only, like chartAttributionHidden above.
  const exportFrameworkVersion = useAppStore(selectExportFrameworkVersion);
  const chartBadgeHidden = useAppStore((s) => s.chartBadgeHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);
  const footerScoresHidden = useAppStore((s) => s.footerScoresHidden);

  // ONE observer on the frame, not two. The chart hook already watches this element to drive its fit,
  // and it publishes the width it measured — so the chrome that scales with the chart (title size,
  // track badge, cluster legend) reads that instead of adding a second ResizeObserver to the same box
  // and a second `offsetWidth` read per frame.
  const { chartRef, relayout, frameWidth: chartWidth, canvasEpoch } = useCompetencyChart(canvasRef, frameRef);

  const trimmedTitle = String(title).trim();
  // When the title is enabled but blank, show a muted placeholder on the chart (it also bakes into
  // the export) while the form input stays empty. The placeholder text lives in SITE_COPY.
  const titleIsBlank = trimmedTitle.length === 0;
  const displayTitle = titleIsBlank ? SITE_COPY.chartTitlePlaceholder : trimmedTitle;
  const showVisibleTitle = !chartTitleHidden;
  const showBadge = !chartBadgeHidden;
  const showTitleRow = showVisibleTitle || showBadge;
  const layoutWidth = chartWidth || FE_UI.page.chartMinWidthPx;
  const titleSizePx = getChartTitleSizePx(layoutWidth);
  // MIDDLE-ELLIPSIS THE TITLE so a long profile name stays on one line with both ends readable, rather than
  // wrapping (which grew the row and pushed the chart down) or being end-truncated by `truncate` (which eats
  // the part that usually tells two profiles apart). `isVisible` is passed through because the tool tab is
  // `display: none` when Theory is open and nothing can be measured there — see the hook.
  const fittedTitle = useMiddleEllipsis(titleMeasureRef, displayTitle, isVisible);
  // Chart width alone, never what is in the row, and it must EQUAL the <h2>'s line box rather than a rounded
  // version of it. See docs/DECISIONS.md#the-chart-title-row-reserves-one-height
  const titleRowMinHeight = titleSizePx * TITLE_ROW_LEADING;

  useLayoutEffect(() => {
    if (isVisible) {
      relayout();
    }
  }, [isVisible, relayout]);

  useEffect(() => {
    relayout();
  }, [chartTitleHidden, chartBadgeHidden, chartLegendHidden, relayout]);

  // Copy and Share share one toast key: they sit side by side, each is tappable again straight away,
  // and every outcome answers a single press — so the newest notice replaces the last rather than
  // stacking a second card over it.
  const reportExportOutcome = (result, kind) => {
    const { ok, event, method, toast, toastVariant } = resolveExportOutcome(result, kind);
    if (ok) {
      track(event, { method });
    }
    if (toast) {
      showToast(toast, { variant: toastVariant, key: CHART_EXPORT_TOAST_KEY });
    }
  };

  const handleCopy = async () => {
    try {
      const result = await copyChartAsImageToClipboard({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
        profileName: title,
        attributionHidden: chartAttributionHidden,
        uhd: chartUhdExport,
        frameworkVersion: exportFrameworkVersion,
      });
      reportExportOutcome(result, "copy");
    } catch (e) {
      console.error(e);
      reportExportOutcome(null, "copy");
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
        frameworkVersion: exportFrameworkVersion,
      });
      reportExportOutcome(result, "share");
    } catch (e) {
      console.error(e);
      reportExportOutcome(null, "share");
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      {/* `mb-3` IS THE WHOLE SPACE below this toolbar, which is why the parent column has no `gap`. Keep it in
          step with theory's changelog row. See docs/DECISIONS.md#the-tool-toolbar-owns-its-spacing
          `relative` WITHOUT A Z-INDEX: that would make this row a stacking context and cap both children's
          dropdowns inside it (`LAYER` in constants/layers.js has the rule). */}
      <div className="relative mb-3 flex w-full min-w-0 items-center justify-between gap-2 print:hidden">
        <ExportMenu onCopy={handleCopy} onShare={handleShare} />
        <ChartDisplayMenu />
      </div>

      {/* Wraps `exportRef`, never IS it — everything inside that ref is rasterised into the exported PNG, so a
          border/padding/shadow here would bake a cropped card frame into every copied image. No left bezel:
          the chart isn't a cluster member. `p-3` at every width (no `sm:p-4`) because FE_UI.page.maxWidthPx is
          sized backwards from this exact padding to land the frame on `chartMaxWidthPx` — see ui.js. */}
      <div
        className={cn(
          CARD_PLAIN,
          "w-full min-w-0 self-stretch overflow-hidden p-3 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none",
        )}
      >
        <div ref={exportRef} className="relative flex w-full min-w-0 flex-col self-stretch">
          {/* THE ROW CARRIES THE TITLE'S SIZE and the <h2> inherits it, so the size is applied in one place.
            No `leading-none` here: nothing in the row renders bare text, the badge setting its own and the
            title carrying `leading-tight`.
            See docs/DECISIONS.md#the-chart-title-row-reserves-one-height */}
          {showTitleRow ? (
            <div
              data-chart-title-row
              className="relative z-[1] mb-3 flex w-full min-w-0 items-center gap-3"
              style={{ fontSize: titleSizePx, minHeight: titleRowMinHeight }}
            >
              {/* No height passed — the pill sizes itself from `em` padding (see TrackBadge). `chartWidth` keeps it in
                proportion to the title, and is unconditional: gating it on `showVisibleTitle` made one toggle
                resize the pill as well. */}
              {showBadge ? <TrackBadge variant={attachedBadge} size="md" className="shrink-0" chartWidth={chartWidth} /> : null}
              {showVisibleTitle ? (
                <h2
                  id="competency-chart-heading"
                  /* IDENTICAL TO THE THEORY TAB'S FRAMEWORK TITLE but for `text-left`, and deliberately carrying
                   `leading-tight` as a class rather than an inline `lineHeight`. NO `fontSize` of its own: it
                   inherits the row's, so its leading and the row's floor resolve against one number.
                   See docs/DECISIONS.md#the-chart-title-row-reserves-one-height */
                  className={`relative m-0 min-w-0 flex-1 overflow-hidden text-left leading-tight tracking-tight whitespace-nowrap only:ml-2 ${titleIsBlank ? "text-slate-900/30 font-regular" : "text-slate-900 font-extrabold"}`}
                  title={titleIsBlank ? undefined : displayTitle}
                  aria-label={titleIsBlank ? undefined : displayTitle}
                >
                  {/* THE MEASURING ELEMENT, EMPTY as far as React is concerned: the fitting loop writes
                    candidates in and reads `scrollWidth` back, so the two never fight over its contents.
                    `absolute` takes it out of the row while `left-0 right-0` holds it to this <h2>'s width,
                    which is what the text is fitted against; it inherits the heading's type so it measures what
                    will be painted. `invisible` not `hidden`, or it has no `scrollWidth` at all. */}
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
              {/* `key` IS THE RECOVERY, not a list key: bumping it discards a canvas whose 2D context the
                browser lost while the app was backgrounded and mounts a fresh one — see
                hooks/useCanvasContextRecovery.js. */}
              <canvas key={canvasEpoch} ref={canvasRef} id="competencyChart" data-radar-canvas aria-labelledby="competency-chart-heading" />
            </div>
          </div>

          {!chartLegendHidden ? (
            <div
              data-chart-export="chart-legend-card"
              className="mx-auto mt-4 flex w-fit max-w-full items-center justify-center rounded-lg border border-border bg-muted px-4 py-2 leading-none"
            >
              <ClusterLegend chartWidth={chartWidth} />
            </div>
          ) : null}

          {FEATURE_SCORES_SETTINGS && !footerScoresHidden ? (
            <div data-chart-export="chart-scores" className="mt-4 flex flex-col gap-2 xs:gap-3" aria-label="Cluster averages and score summary">
              <ChartScores />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
