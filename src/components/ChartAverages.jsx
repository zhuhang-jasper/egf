import { getScoreCardFontSizesPx } from "@/chart/fonts";
import {
  BREADTH_TOP_RATIO,
  CAREER_BREADTH_WEIGHT,
  CAREER_PEAK_WEIGHT,
  CLUSTERS,
  FE_UI,
  FEATURE_SCORES_SETTINGS,
  getClusterSurfaceBg,
  getPillarGroupOrder,
} from "@/constants";
import { computeAverages, formatAvgScore } from "@/constants/scores";
import { cn } from "@/utils";

import { useAppStore } from "@/store/useAppStore";

/** Cluster score cards — surface tint from cluster color; text/border from cluster tokens. */
function getClusterAvgCardTheme(id) {
  const cluster = CLUSTERS[id];
  if (!cluster) {
    return null;
  }
  return {
    cardStyle: {
      backgroundColor: getClusterSurfaceBg(cluster.color),
      borderColor: cluster.textColor,
      color: cluster.textColor,
    },
    valueColor: cluster.textColor,
  };
}

function AvgCard({ label, value, sub, className, title, labelPx, valuePx, subPx, cardStyle, valueColor }) {
  return (
    <div
      data-chart-export="chart-avg-card"
      title={title}
      style={cardStyle}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 leading-none rounded-lg border px-2 py-1.5 text-center min-[450px]:px-4 min-[450px]:py-1.5",
        className,
      )}
    >
      <span className="max-w-[11rem] font-semibold tracking-wide" style={{ fontSize: labelPx }}>
        {label}
      </span>
      <span className="font-extrabold tabular-nums" style={{ fontSize: valuePx, color: valueColor }}>
        {value}
      </span>
      {sub ? (
        <span className="max-w-[12rem] font-bold opacity-95" style={{ fontSize: subPx }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

export function ChartAverages({ chartWidth = 0 }) {
  const levels = useAppStore((s) => s.levels);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const scoresHidden = useAppStore((s) => s.footerScoresHidden);

  if (!FEATURE_SCORES_SETTINGS || scoresHidden) {
    return null;
  }

  const { breadth, human, effective, career, clusters } = computeAverages(levels, trackVariant);
  const pillarCount = levels.length;
  const breadthK = Math.ceil(pillarCount * BREADTH_TOP_RATIO);
  const { labelPx, valuePx, subPx } = getScoreCardFontSizesPx(chartWidth || FE_UI.page.minWidthPx);
  const effectiveTitle = `${CAREER_PEAK_WEIGHT * 100}% strength + ${CAREER_BREADTH_WEIGHT * 100}% breadth — composite for seniority bands.`;
  const clusterGroups = getPillarGroupOrder(trackVariant);

  return (
    <div data-chart-export="chart-averages" className="flex flex-col gap-2 min-[450px]:gap-3" aria-label="Cluster averages and score summary">
      <div className="grid grid-cols-3 gap-2 min-[450px]:gap-3">
        {clusterGroups.map(({ id }) => {
          const cluster = CLUSTERS[id];
          const theme = getClusterAvgCardTheme(id);
          if (!cluster || !theme) {
            return null;
          }
          return (
            <AvgCard
              key={id}
              label={cluster.label}
              value={formatAvgScore(clusters[id])}
              title={`Mean pillar score in the ${cluster.label} cluster.`}
              labelPx={labelPx}
              valuePx={valuePx}
              subPx={subPx}
              cardStyle={theme.cardStyle}
              valueColor={theme.valueColor}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2 min-[450px]:gap-3">
        <AvgCard
          label="Breadth"
          value={formatAvgScore(breadth)}
          title={`Mean of your ${breadthK} highest pillar scores (of ${pillarCount}).`}
          labelPx={labelPx}
          valuePx={valuePx}
          subPx={subPx}
          className="border-slate-600 bg-slate-50 text-slate-800 [&_span:nth-child(2)]:text-slate-900"
        />
        <AvgCard
          label="Peak"
          value={formatAvgScore(human)}
          title={`Mean of your 3 highest pillar scores (of ${pillarCount}).`}
          labelPx={labelPx}
          valuePx={valuePx}
          subPx={subPx}
          className="border-amber-600 bg-amber-50 text-amber-900 [&_span:nth-child(2)]:text-amber-700"
        />
        <AvgCard
          label="Effective"
          value={formatAvgScore(effective)}
          title={effectiveTitle}
          labelPx={labelPx}
          valuePx={valuePx}
          subPx={subPx}
          className="border-violet-600 bg-violet-50 text-violet-900 [&_span:nth-child(2)]:text-violet-700"
        />
        <AvgCard
          label="Seniority"
          value={career ? career.code : "—"}
          sub={career ? career.role : ""}
          title="L2+ needs peak, breadth, and cluster mins (technical all tracks; product FE only) — see scoring constants."
          labelPx={labelPx}
          valuePx={valuePx}
          subPx={subPx}
          className="border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700"
        />
      </div>
    </div>
  );
}
