import { getChartSecondaryLabelSizePx, getClusterLegendSwatchPx } from "@/lib/chart/fonts";
import { CLUSTERS, FE_UI, getPillarGroupOrder } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

export function ClusterLegend({ className, hidden = false, chartWidth = 0 }) {
  const trackVariant = useAppStore((s) => s.trackVariant);
  const groups = getPillarGroupOrder(trackVariant);
  const width = chartWidth || FE_UI.page.minWidthPx;
  const labelPx = getChartSecondaryLabelSizePx(width);
  const swatchPx = getClusterLegendSwatchPx(width);

  return (
    <ul
      data-chart-export="cluster-legend"
      className={cn(
        "m-0 flex list-none flex-wrap items-center justify-center gap-x-5 gap-y-2 p-0",
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
          <li key={id} data-chart-export="cluster-legend-item" className="inline-flex items-center gap-2.5">
            <span
              data-chart-export="cluster-legend-swatch"
              className="shrink-0 border border-black/20"
              style={{ backgroundColor: cluster.color, width: swatchPx, height: swatchPx }}
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
