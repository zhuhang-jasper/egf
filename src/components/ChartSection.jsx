import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ImageDown, Settings, Share2 } from "lucide-react";

import { ChartScores } from "@/components/ChartScores";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";

import { useAppStore } from "@/store/useAppStore";

import { getChartTitleSizePx, getTrackBadgeMdHeightPx } from "@/chart/fonts";
import { FE_UI, FEATURE_SCORES_SETTINGS, SITE_COPY } from "@/constants";
import { TOOLBAR_ICON_SURFACE, TOOLBAR_SURFACE } from "@/styles/toolbar";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { copyChartAsImageToClipboard, shareChartAsImage } from "@/utils/copy-chart-image";

// select-none: these rows get clicked repeatedly to flip a setting, and a double-click would
// otherwise select the label text.
function DisplayCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-1.5 text-xs hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-input accent-foreground"
      />
      <span>{label}</span>
    </label>
  );
}

function ChartDisplayMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const setChartLegendHidden = useAppStore((s) => s.setChartLegendHidden);
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
          <DisplayCheckbox label="Chart" checked={!levelsPolygonHidden} onChange={(v) => setLevelsPolygonHidden(!v)} />
          <DisplayCheckbox label="Level labels" checked={!chartLevelTicksHidden} onChange={(v) => setChartLevelTicksHidden(!v)} />
          <DisplayCheckbox label="Legend" checked={!chartLegendHidden} onChange={(v) => setChartLegendHidden(!v)} />
          {/* Appearance of the pillar labels themselves, as opposed to the show/hide toggles above. */}
          <hr className="my-1 border-t border-border" />
          <DisplayCheckbox label="Colored pillar labels" checked={clusterLabelColors} onChange={setClusterLabelColors} />
          <DisplayCheckbox label="Pillar emoji" checked={!pillarEmojiHidden} onChange={(v) => setPillarEmojiHidden(!v)} />
          {FEATURE_SCORES_SETTINGS ? (
            <DisplayCheckbox label="Scores" checked={!footerScoresHidden} onChange={(v) => setFooterScoresHidden(!v)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Whether the Web Share API can share files here. True on mobile Safari/Chrome (and a few
 * desktop browsers like Safari/Edge); false on desktop Chrome-macOS / Firefox. We probe with a
 * tiny dummy file because canShare gates on the files payload specifically. Computed once.
 *
 * THE STRICT FILE PROBE, and deliberately stricter than the theory tab's share gate (see
 * TheoryContent's CAN_SHARE_LINK, which only asks for `navigator.share`). The asymmetry is the point:
 * THIS share exists to send the user's chart, so a share sheet that cannot carry the image cannot do the
 * job and the button should not appear. The theory share sends a LINK with an image attached as a bonus,
 * so it still works — degraded — without file support. Same API, different payload, different gate.
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
 * Image-export controls, as two standalone buttons: "Copy image" is always shown (copies to the
 * clipboard, or downloads as a fallback). "Share" is shown additionally only where the Web Share
 * API can share files (e.g. mobile Safari/Chrome), opening the OS share sheet.
 *
 * LABELLED, in the theory tab's toolbar surface (see styles/toolbar.js). These two are the same kind of
 * page-level action as that tab's print/share icons and sit in the same place on the page, so they take
 * the same muted-slate surface instead of the default `outline` button they used to wear — switching tabs
 * should not restyle the chrome. They keep their text because neither glyph is self-explanatory here:
 * `ImageDown` reads as "save an image" (which is the COPY button's fallback, not its primary path) and
 * `Share2` is a generic share mark, so the word is what says which action this is.
 *
 * Share comes FIRST: it is the primary action where it exists, and copy is the fallback for everywhere
 * else. Reading order matches that.
 */
function ExportMenu({ onCopy, onShare }) {
  return (
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
        <ImageDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
  const showToast = useAppStore((s) => s.showToast);

  const title = useAppStore((s) => s.title);
  const attachedBadge = useAppStore((s) => s.attachedBadge);
  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
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
  const titleRowHeightPx = getTrackBadgeMdHeightPx(layoutWidth);

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

  /* `gap-2` on the column below, rather than a margin on the toolbar alone, so the space under the
     toolbar is expressed exactly as the theory tab expresses its own — a column `gap-2` plus the row's
     `mb-2` (see TheoryContent). Same classes, same total, nothing to convert when comparing the two.
     The column has only two children (the toolbar and the export block), so the gap applies at exactly
     one boundary: the one being spaced. It also sits OUTSIDE `exportRef`, so it cannot reach the image. */
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2">
      {/* Its own `mb-2` on top of the column's `gap-2` puts 16px below this toolbar. Theory's changelog
          row is the same row at the same position in the other tab, spaced identically — keep the two in
          step, or the page appears to shift when you switch tabs. (The `gap-2` in this row's own class
          list is unrelated: that one spaces its buttons horizontally.)

          `print:hidden` for the same reason theory's row carries it: these buttons only exist to be
          clicked, and "Copy image" on paper is nonsense. The chart below is the thing being printed.

          `justify-between` PINS ONE GROUP TO EACH END — the export actions at the left, the display-settings
          gear at the right — which is the same division theory's toolbar makes (page actions left, changelog
          right). Everything used to be bunched at the right together, so the gear (a settings control) read as
          a third export button. */}
      <div className="relative z-[2] flex w-full min-w-0 items-center justify-between gap-2 mb-2 print:hidden">
        <ExportMenu onCopy={handleCopy} onShare={handleShare} />
        <ChartDisplayMenu />
      </div>

      <div ref={exportRef} className="relative flex w-full min-w-0 flex-col self-stretch">
        {showTitleRow ? (
          <div className="relative z-[1] flex w-full min-w-0 items-center gap-3 leading-none mb-2" style={{ minHeight: titleRowHeightPx }}>
            {showBadge ? <TrackBadge variant={attachedBadge} size="md" className="shrink-0" chartWidth={chartWidth} /> : null}
            {showVisibleTitle ? (
              <h2
                id="competency-chart-heading"
                className={`m-0 min-w-0 flex-1 text-left only:ml-2 ${titleIsBlank ? "text-black/30 font-regular" : "text-black font-bold"}`}
                style={{ fontSize: titleSizePx, lineHeight: `${titleRowHeightPx}px` }}
              >
                {displayTitle}
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

        <div ref={frameRef} className="relative z-0 mx-auto w-full max-w-full box-border" style={{ minHeight: FE_UI.chartFrame.minChartHeightPx }}>
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
