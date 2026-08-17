import { getChartSecondaryLabelSizePx, getClusterLegendSwatchPx } from "@/chart/fonts";
import { CLUSTERS, FE_UI, getPillarGroupOrder } from "@/constants";
import { cn } from "@/utils";

export function ClusterLegend({ className, hidden = false, chartWidth = 0 }) {
  const groups = getPillarGroupOrder();
  const width = chartWidth || FE_UI.page.chartMinWidthPx;
  const labelPx = getChartSecondaryLabelSizePx(width);
  const swatchPx = getClusterLegendSwatchPx(width);

  return (
    <ul
      data-chart-export="cluster-legend"
      className={cn(
        "m-0 flex list-none flex-wrap items-center justify-center gap-x-4 gap-y-2 p-0",
        hidden && "invisible pointer-events-none",
        className,
      )}
      aria-hidden={hidden || undefined}
      aria-label="Pillar clusters"
    >
      {groups.map(({ id }) => {
        const cluster = CLUSTERS[id];
        if (!cluster) {
          return null;
        }
        return (
          <li key={id} data-chart-export="cluster-legend-item" className="inline-flex items-center gap-2">
            {/* `chartBg`, the same value the radar's wedges are filled with (chart/plugins.js) — a legend
                swatch has to be the colour actually on the chart, or it is explaining something else. It was
                the saturated `color`, which left vivid swatches sitting under noticeably paler wedges. */}
            <span
              data-chart-export="cluster-legend-swatch"
              className="shrink-0 border border-black/20"
              style={{ backgroundColor: cluster.chartBg, width: swatchPx, height: swatchPx }}
              aria-hidden
            />
            <span data-chart-export="cluster-legend-label" className="font-bold text-foreground/90" style={{ fontSize: labelPx }}>
              {cluster.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
