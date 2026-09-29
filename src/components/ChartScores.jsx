import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { CAREER_STAGE_BANDS, CLUSTERS, getPillarGroupOrder, PILLAR_COUNT, TRACK_FORK_STAGE, TRACKS } from "@/constants";
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

function ScoreCard({ label, value, sub, detail, className, title, cardStyle, valueColor }) {
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
      {detail ? <span className={cn("max-w-[12rem] font-semibold opacity-80", TOOL_TEXT.annotation)}>{detail}</span> : null}
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

const METRIC_LABEL = { keyMean: "peak", supportMean: "breadth", minPillar: "lowest pillar" };

const STAGE_INDEX = new Map(CAREER_STAGE_BANDS.map(({ code }, i) => [code, i]));

/** One debug card per track: its own stage, its peak / breadth, and the minimum blocking the next stage. */
function buildTrackCards({ tracks, track: matched, minPillar }) {
  return tracks.map(({ track, stage, keyMean, supportMean, next }) => {
    const { label, keyPillars } = TRACKS[track];
    const above = CAREER_STAGE_BANDS[STAGE_INDEX.get(stage) + 1];
    return {
      key: track,
      label,
      value: stage,
      sub: `Peak ${formatAvgScore(keyMean)} · Breadth ${formatAvgScore(supportMean)}`,
      detail: next ? `${above.code} needs ${METRIC_LABEL[next.metric]} ${formatAvgScore(next.required)}` : null,
      title: `Peak: mean of the ${keyPillars.length} key pillars. Breadth: mean of the other ${PILLAR_COUNT - keyPillars.length}. Lowest pillar (AI Leverage excluded): ${formatAvgScore(minPillar)}.`,
      className:
        track === matched
          ? "border-2 border-sky-600 bg-sky-50 text-sky-900 [&_span:nth-child(2)]:text-sky-700"
          : "border-2 border-slate-300 bg-white text-slate-600 [&_span:nth-child(2)]:text-slate-700",
    };
  });
}

/** The end-user answer: stage, role and track; below the fork the track reads as the shared foundation. */
function buildSummaryCard({ stage, track }) {
  const band = CAREER_STAGE_BANDS[STAGE_INDEX.get(stage)];
  const forked = STAGE_INDEX.get(stage) >= STAGE_INDEX.get(TRACK_FORK_STAGE);
  return {
    key: "seniority",
    label: "Seniority",
    value: band.code,
    sub: `${band.role} · ${forked ? TRACKS[track].label : "Foundation"}`,
    title: forked
      ? "Best stage across the three tracks, and the track it was reached on."
      : `Best stage across the three tracks. Tracks fork at ${TRACK_FORK_STAGE}; until then the whole chart grows as one foundation.`,
    className: "border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700",
  };
}

export function ChartScores() {
  const pillarLevels = useAppStore((s) => s.pillarLevels);

  const { clusters, career } = computeAverages(pillarLevels);
  const rows = [
    { key: "clusters", cols: "grid-cols-3", cards: buildClusterCards(clusters) },
    { key: "tracks", cols: "grid-cols-3", cards: buildTrackCards(career) },
    { key: "summary", cols: "grid-cols-1", cards: [buildSummaryCard(career)] },
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
