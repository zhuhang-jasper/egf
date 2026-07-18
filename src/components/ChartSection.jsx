import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Copy, Settings, Share } from "lucide-react";

import { ChartScores } from "@/components/ChartScores";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";
import { useElementWidth } from "@/hooks/useElementWidth";

import { useAppStore } from "@/store/useAppStore";

import { getChartTitleSizePx, getTrackBadgeMdHeightPx } from "@/chart/fonts";
import { FE_UI, FEATURE_SCORES_SETTINGS, SITE_COPY } from "@/constants";
import { track } from "@/utils/analytics";
import { copyChartAsImageToClipboard, shareChartAsImage } from "@/utils/copy-chart-image";

function DisplayCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-xs hover:bg-muted/60">
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
        className="group relative"
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
 */
function ExportMenu({ onCopy, onShare }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {CAN_SHARE_FILES ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          onClick={onShare}
          className="gap-1"
          title="Share the chart image"
          aria-label="Share image"
        >
          <Share className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Share image
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        onClick={onCopy}
        className="gap-1"
        title="Copy the chart image to your clipboard"
        aria-label="Copy image"
      >
        <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Copy image
      </Button>
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

  const { chartRef, relayout } = useCompetencyChart(canvasRef, frameRef);
  const chartWidth = useElementWidth(frameRef, isVisible);

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

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div className="relative z-[2] flex w-full min-w-0 items-center justify-end gap-2 border-b pb-3 border-border mb-3">
        <div className="flex shrink-0 items-center gap-2">
          <ExportMenu onCopy={handleCopy} onShare={handleShare} />
          <ChartDisplayMenu />
        </div>
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
            <canvas ref={canvasRef} id="competencyChart" aria-labelledby="competency-chart-heading" />
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
