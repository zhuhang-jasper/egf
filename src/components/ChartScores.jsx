import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { BREADTH_TOP_RATIO, CAREER_BREADTH_WEIGHT, CAREER_PEAK_WEIGHT, CLUSTERS, getClusterSurfaceBg, getPillarGroupOrder } from "@/constants";
import { computeAverages, formatAvgScore } from "@/constants/scores";
import { cn } from "@/utils";

/** Cluster score cards — surface tint from cluster color; text/border from cluster tokens. */
function getClusterScoreCardTheme(id) {
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

function ScoreCard({ label, value, sub, className, title, cardStyle, valueColor }) {
  return (
    <div
      data-chart-export="chart-score-card"
      style={cardStyle}
      className={cn(
        "group relative flex min-w-0 flex-col items-center justify-center gap-1 leading-none rounded-lg border px-2 py-1.5 text-center min-[470px]:px-4 min-[470px]:py-1.5",
        className,
      )}
    >
      <span className="max-w-[11rem] text-[10px] font-semibold tracking-wide sm:text-[12px]">{label}</span>
      <span className="text-[16px] font-extrabold tabular-nums sm:text-[20px]" style={{ color: valueColor }}>
        {value}
      </span>
      {sub ? <span className="max-w-[12rem] text-[9px] font-bold opacity-95 sm:text-[12px]">{sub}</span> : null}
      <Tooltip text={title} className="w-[12rem] max-w-[80vw] whitespace-normal text-center font-normal leading-snug" />
    </div>
  );
}

/** Cluster mean cards (one per pillar group), themed from the cluster tokens. */
function buildClusterCards(clusters) {
  return getPillarGroupOrder()
    .map(({ id }) => {
      const cluster = CLUSTERS[id];
      const theme = getClusterScoreCardTheme(id);
      if (!cluster || !theme) {
        return null;
      }
      return {
        key: id,
        label: cluster.label,
        value: formatAvgScore(clusters[id]),
        title: `Mean pillar score in the ${cluster.label} cluster.`,
        cardStyle: theme.cardStyle,
        valueColor: theme.valueColor,
      };
    })
    .filter(Boolean);
}

/** Aggregate summary cards (breadth / peak / effective / seniority), with static cluster-agnostic themes. */
function buildSummaryCards({ breadth, human, effective, career, breadthK, pillarCount, effectiveTitle }) {
  return [
    {
      key: "breadth",
      label: "Breadth",
      value: formatAvgScore(breadth),
      title: `Mean of your ${breadthK} highest pillar scores (of ${pillarCount}).`,
      className: "border-slate-600 bg-slate-50 text-slate-800 [&_span:nth-child(2)]:text-slate-900",
    },
    {
      key: "peak",
      label: "Peak",
      value: formatAvgScore(human),
      title: `Mean of your 3 highest pillar scores (of ${pillarCount}).`,
      className: "border-amber-600 bg-amber-50 text-amber-900 [&_span:nth-child(2)]:text-amber-700",
    },
    {
      key: "effective",
      label: "Effective",
      value: formatAvgScore(effective),
      title: effectiveTitle,
      className: "border-violet-600 bg-violet-50 text-violet-900 [&_span:nth-child(2)]:text-violet-700",
    },
    {
      key: "seniority",
      label: "Seniority",
      value: career ? career.code : "—",
      sub: career ? career.role : "",
      // No tooltip for now — was: "L2+ needs peak, breadth, and cluster mins (technical all tracks; product FE only) — see scoring constants."
      className: "border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700",
    },
  ];
}

export function ChartScores() {
  const levels = useAppStore((s) => s.levels);

  const { breadth, human, effective, career, clusters } = computeAverages(levels);
  const pillarCount = levels.length;
  const breadthK = Math.ceil(pillarCount * BREADTH_TOP_RATIO);
  const effectiveTitle = `${Math.round(CAREER_PEAK_WEIGHT * 100)}% peak + ${Math.round(CAREER_BREADTH_WEIGHT * 100)}% breadth — composite for seniority bands.`;

  const clusterCards = buildClusterCards(clusters);
  const summaryCards = buildSummaryCards({ breadth, human, effective, career, breadthK, pillarCount, effectiveTitle });

  return (
    <>
      <div className="grid grid-cols-3 gap-2 min-[470px]:gap-3">
        {clusterCards.map(({ key, ...card }) => (
          <ScoreCard key={key} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 min-[470px]:gap-3">
        {summaryCards.map(({ key, ...card }) => (
          <ScoreCard key={key} {...card} />
        ))}
      </div>
    </>
  );
}
