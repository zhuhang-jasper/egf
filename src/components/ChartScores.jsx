import { useState } from "react";

import { Star } from "lucide-react";

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

function ScoreCard({ label, value, sub, detail, className, title, cardStyle, valueColor, onClick, pressed, starred, connector }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { "type": "button", onClick, "aria-pressed": pressed } : {})}
      data-chart-export="chart-score-card"
      style={cardStyle}
      className={cn(
        "group relative flex min-w-0 flex-col items-center justify-center gap-1 leading-none rounded-lg border px-2 py-1.5 text-center xs:px-4 xs:py-1.5",
        onClick && "cursor-pointer",
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
      {/* Last child, so it does not shift the `span:nth-child(2)` value colour the card themes rely on. */}
      {starred ? <Star aria-label="Strongest track" role="img" className="absolute -left-2 -top-2 size-5 fill-amber-400 text-amber-500" /> : null}
      {/* Starts past this card's 2px border and spans only the row gap (gap-2 / xs:gap-3), so it never overlaps either border. */}
      {connector ? (
        <span aria-hidden className={cn("absolute left-1/2 top-[calc(100%+2px)] h-2 -translate-x-1/2 border-l-2 xs:h-3", connector)} />
      ) : null}
    </Tag>
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

/**
 * One debug card per track: its own stage, its peak / breadth, and the minimum blocking the next stage.
 * The star marks the strongest track; the border marks the selected one, which the summary card reads.
 */
function buildTrackCards({ tracks, track: strongest, minPillar }, selected, onSelect) {
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
      onClick: () => onSelect(track),
      pressed: track === selected,
      starred: track === strongest,
      connector: track === selected ? cn("border-sky-600", track !== strongest && "border-dotted") : null,
      className: cn(
        "border-2",
        track !== strongest && "border-dotted opacity-75",
        track === selected
          ? "border-sky-600 bg-sky-50 text-sky-900 [&_span:nth-child(2)]:text-sky-700"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 [&_span:nth-child(2)]:text-slate-700",
      ),
    };
  });
}

/** The end-user answer for the selected track: stage, role and track; below the fork the track reads as the shared foundation. */
function buildSummaryCard({ tracks, track: strongest }, selected) {
  const { stage } = tracks.find(({ track }) => track === selected);
  const band = CAREER_STAGE_BANDS[STAGE_INDEX.get(stage)];
  const forked = STAGE_INDEX.get(stage) >= STAGE_INDEX.get(TRACK_FORK_STAGE);
  let title = `Tracks fork at ${TRACK_FORK_STAGE}; until then the whole chart grows as one foundation.`;
  if (forked) {
    title =
      selected === strongest
        ? "Your stage on your strongest track."
        : `Your stage on the ${TRACKS[selected].label} track. Your strongest is ${TRACKS[strongest].label}.`;
  }
  return {
    key: "seniority",
    label: "Seniority",
    value: band.code,
    sub: `${band.role} · ${forked ? TRACKS[selected].label : "Foundation"}`,
    title,
    className: cn("border-2 border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700", selected !== strongest && "border-dotted opacity-75"),
  };
}

export function ChartScores() {
  const pillarLevels = useAppStore((s) => s.pillarLevels);
  const profileId = useAppStore((s) => s.activeSavedProfileId);
  // Scoped to the profile it was made on, so switching profile falls back to the strongest track.
  const [picked, setPicked] = useState({ profileId, track: null });

  const { clusters, career } = computeAverages(pillarLevels);
  const selected = picked.profileId === profileId && picked.track ? picked.track : career.track;
  const onSelect = (track) => setPicked({ profileId, track });

  const rows = [
    { key: "clusters", cols: "grid-cols-3", exportOmit: true, cards: buildClusterCards(clusters) },
    { key: "tracks", cols: "grid-cols-3", exportOmit: true, cards: buildTrackCards(career, selected, onSelect) },
    { key: "summary", cols: "grid-cols-1", exportOmit: selected !== career.track, cards: [buildSummaryCard(career, selected)] },
  ];
  // The export always shows the strongest track, so a different selection ships a hidden twin for export-clone to reveal.
  if (selected !== career.track) {
    rows.push({ key: "summary-export", cols: "grid-cols-1", exportOnly: true, cards: [buildSummaryCard(career, career.track)] });
  }

  return (
    <>
      {rows.map(({ key, cols, exportOmit, exportOnly, cards }) => (
        <div
          key={key}
          data-export-omit={exportOmit || undefined}
          data-export-only={exportOnly || undefined}
          hidden={exportOnly}
          className={cn("grid gap-2 xs:gap-3", cols)}
        >
          {cards.map(({ key: cardKey, ...card }) => (
            <ScoreCard key={cardKey} {...card} />
          ))}
        </div>
      ))}
    </>
  );
}
