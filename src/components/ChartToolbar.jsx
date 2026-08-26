import { useRef, useState } from "react";

// `Image` is aliased because the bare name is a global DOM constructor (`new Image()`), and a component
// shadowing it at module scope is a trap for anything later in this file that wants the real one.
import { Image as ImageIcon, Settings, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuCheckboxItem } from "@/components/ui/menu-checkbox-item";
import { MenuPanel } from "@/components/ui/menu-panel";
import { Tooltip } from "@/components/ui/Tooltip";

import { useMenuPosition } from "@/hooks/useMenuPosition";

import { useAppStore } from "@/store/useAppStore";

import {
  FEATURE_CHART_ATTRIBUTION_SETTING,
  FEATURE_CHART_LEGEND_SETTING,
  FEATURE_CHART_STRUCTURE_SETTINGS,
  FEATURE_CHART_UHD_EXPORT_SETTING,
  FEATURE_SCORES_SETTINGS,
} from "@/constants";
import { TOOLBAR_ICON_SURFACE, TOOLBAR_SURFACE } from "@/styles/toolbar";
import { cn } from "@/utils";

function ChartDisplayMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

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

  // This menu had no flip at all — it was hardcoded to open downward, so near the viewport foot its lower rows
  // went under the bottom nav. It is the longest menu in the app, so it is the one that needed it most.
  const { openUp } = useMenuPosition({ open, onClose: () => setOpen(false), rootRef, menuRef });

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
            (LAYER.chrome, which the tooltip sits below) and get covered. */}
        {open ? null : <Tooltip text="Chart display settings" placement="bottom" />}
      </Button>
      {open ? (
        <MenuPanel ref={menuRef} openUp={openUp} align="right" padded role="menu" aria-label="Chart display settings">
          {/* "Profile name", not "Title": this hides the profile's name, which is what the user typed and what
              the app calls it everywhere else. The store key stays `chartTitleHidden` — it is persisted. */}
          <MenuCheckboxItem label="Profile name" checked={!chartTitleHidden} onChange={(v) => setChartTitleHidden(!v)} />
          <MenuCheckboxItem label="Badge" checked={!chartBadgeHidden} onChange={(v) => setChartBadgeHidden(!v)} />
          {/* `adminOnly` ON EVERY ROW INSIDE A FEATURE_* TEST, and only on those — the flag and the gate are the
              same decision written twice, once to decide whether the row exists and once to mark it. Adding a
              row here means setting both. */}
          {FEATURE_CHART_STRUCTURE_SETTINGS ? (
            <>
              <MenuCheckboxItem adminOnly label="Chart" checked={!levelsPolygonHidden} onChange={(v) => setLevelsPolygonHidden(!v)} />
              <MenuCheckboxItem adminOnly label="Level labels" checked={!chartLevelTicksHidden} onChange={(v) => setChartLevelTicksHidden(!v)} />
            </>
          ) : null}
          {FEATURE_CHART_LEGEND_SETTING ? (
            <MenuCheckboxItem adminOnly label="Legend" checked={!chartLegendHidden} onChange={(v) => setChartLegendHidden(!v)} />
          ) : null}
          {/* EXPORT-ONLY ROWS, unlike every other toggle in this menu: neither the credit line nor the export
              resolution is anything on screen, so these change the copied/shared PNG and nothing the user is
              looking at. Both are labelled for the image rather than the chart for that reason. */}
          {FEATURE_CHART_ATTRIBUTION_SETTING ? (
            <MenuCheckboxItem
              adminOnly
              label="Attribution on export"
              checked={!chartAttributionHidden}
              onChange={(v) => setChartAttributionHidden(!v)}
            />
          ) : null}
          {FEATURE_CHART_UHD_EXPORT_SETTING ? (
            <MenuCheckboxItem adminOnly label="Hires export (5x)" checked={chartUhdExport} onChange={setChartUhdExport} />
          ) : null}
          {/* Appearance of the pillar labels themselves, as opposed to the show/hide toggles above. */}
          <hr className="my-1 border-t border-border" />
          <MenuCheckboxItem label="Colored pillar labels" checked={clusterLabelColors} onChange={setClusterLabelColors} />
          <MenuCheckboxItem label="Pillar emoji" checked={!pillarEmojiHidden} onChange={(v) => setPillarEmojiHidden(!v)} />
          {FEATURE_SCORES_SETTINGS ? (
            <MenuCheckboxItem adminOnly label="Scores" checked={!footerScoresHidden} onChange={(v) => setFooterScoresHidden(!v)} />
          ) : null}
        </MenuPanel>
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

export { ChartDisplayMenu, ExportMenu };
