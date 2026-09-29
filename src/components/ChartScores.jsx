import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import {
  CAREER_BREADTH_WEIGHT,
  CAREER_PEAK_WEIGHT,
  CAREER_STAGE_BANDS,
  CLUSTERS,
  getPillarGroupOrder,
  PILLAR_COUNT,
  TRACK_FORK_STAGE,
  TRACKS,
} from "@/constants";
import { computeAverages, formatAvgScore } from "@/constants/scores";
import { TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";

/** Cluster score cards — surface tint from cluster color; border from the brightened bezel; text from the midtone (same tokens the career-track cards use). */
function getClusterScoreCardTheme(id) {
  const cluster = CLUSTERS[id];
  if (!cluster) {
    return null;
  }
  return {
    cardStyle: {
      backgroundColor: cluster.surfaceBg,
      borderColor: cluster.bezel,
      color: cluster.midtone,
    },
    valueColor: cluster.midtone,
  };
}

function ScoreCard({ label, value, sub, className, title, cardStyle, valueColor }) {
  return (
    <div
      data-chart-export="chart-score-card"
      style={cardStyle}
      className={cn(
        "group relative flex min-w-0 flex-col items-center justify-center gap-1 leading-none rounded-lg border px-2 py-1.5 text-center xs:px-4 xs:py-1.5",
        className,
      )}
    >
      <span className={cn("max-w-[11rem] font-semibold tracking-wide", TOOL_TEXT.label)}>{label}</span>
      <span className={cn("font-extrabold tabular-nums", TOOL_TEXT.display)} style={{ color: valueColor }}>
        {value}
      </span>
      {sub ? <span className={cn("max-w-[12rem] font-bold opacity-95", TOOL_TEXT.annotation)}>{sub}</span> : null}
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

/** The matched track's averages (breadth / peak) and their weighted blend (effective). */
function buildAverageCards({ peak, breadth, effective, career }) {
  const { label, keyPillars } = TRACKS[career.track];
  const supportCount = PILLAR_COUNT - keyPillars.length;
  return [
    {
      key: "breadth",
      label: "Breadth",
      value: formatAvgScore(breadth),
      title: `Mean of the ${supportCount} pillars outside the ${label} track's key pillars.`,
      className: "border-slate-600 bg-slate-50 text-slate-800 [&_span:nth-child(2)]:text-slate-900",
    },
    {
      key: "peak",
      label: "Peak",
      value: formatAvgScore(peak),
      title: `Mean of the ${keyPillars.length} key pillars of the ${label} track.`,
      className: "border-amber-600 bg-amber-50 text-amber-900 [&_span:nth-child(2)]:text-amber-700",
    },
    {
      key: "effective",
      label: "Effective",
      value: formatAvgScore(effective),
      title: `${Math.round(CAREER_PEAK_WEIGHT * 100)}% peak + ${Math.round(CAREER_BREADTH_WEIGHT * 100)}% breadth. For reference only, it does not set your stage.`,
      className: "border-violet-600 bg-violet-50 text-violet-900 [&_span:nth-child(2)]:text-violet-700",
    },
  ];
}

/** Stage and the track it was reached on; below the fork the track reads as the shared foundation. */
function buildStageCards({ career }) {
  const band = CAREER_STAGE_BANDS.find(({ code }) => code === career.stage);
  const forked = CAREER_STAGE_BANDS.indexOf(band) >= CAREER_STAGE_BANDS.findIndex(({ code }) => code === TRACK_FORK_STAGE);
  return [
    {
      key: "track",
      label: "Track",
      value: forked ? TRACKS[career.track].label : "Foundation",
      title: forked
        ? "The career track your stage was reached on."
        : `Tracks fork at ${TRACK_FORK_STAGE}. Until then the whole chart grows as one foundation.`,
      className: "border-sky-600 bg-sky-50 text-sky-900 [&_span:nth-child(2)]:text-sky-700",
    },
    {
      key: "seniority",
      label: "Seniority",
      value: band.code,
      sub: band.role,
      title:
        "Best stage across the three tracks. Each stage needs a minimum key-pillar mean, support mean, and lowest pillar (AI Leverage excluded).",
      className: "border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700",
    },
  ];
}

export function ChartScores() {
  const pillarLevels = useAppStore((s) => s.pillarLevels);

  const scores = computeAverages(pillarLevels);
  const rows = [
    { key: "clusters", cols: "grid-cols-3", cards: buildClusterCards(scores.clusters) },
    { key: "averages", cols: "grid-cols-3", cards: buildAverageCards(scores) },
    { key: "stage", cols: "grid-cols-2", cards: buildStageCards(scores) },
  ];

  return (
    <>
      {rows.map(({ key, cols, cards }) => (
        <div key={key} className={cn("grid gap-2 xs:gap-3", cols)}>
          {cards.map(({ key: cardKey, ...card }) => (
            <ScoreCard key={cardKey} {...card} />
          ))}
        </div>
      ))}
    </>
  );
}
