import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { CLUSTERS, getClusterSurfaceBg } from "@/constants";
import { CAREER_TRACK_PROFILES, FOUNDATIONAL_PHASE, JUNIOR_TO_SENIOR, SENIOR_FORK, sortKeyFocusPillars } from "@/constants/theory-data";
import { DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";

// Career-track chart spokes are width-responsive: emoji icons while the chart is narrow (the 3-up
// columned view), full text pillar names once it goes full-width in the stacked/row view. The chart
// also drops the focus-dimming of non-key pillars whenever it's in emoji mode. This px threshold
// sits between the ~1/3-width columned charts and the full-width row charts.
const TRACK_CHART_EMOJI_MAX_WIDTH_PX = 220;

const cardClass = "rounded-xl border border-white/70 shadow-md shadow-slate-200/40";
const levelBadgeClass = cn(
  "inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-white",
  DOC_TEXT.badgeMicro,
  "text-[9px] font-extrabold sm:text-[10px] md:text-[11px]",
);

function LevelBadge({ level, backgroundColor, color }) {
  return (
    <span className={levelBadgeClass} style={{ backgroundColor, color }}>
      {level}
    </span>
  );
}

function buildTrackStyle(cluster, accent) {
  const resolvedAccent = accent ?? cluster.textColor;
  return {
    accent: resolvedAccent,
    chipBg: getClusterSurfaceBg(cluster.color),
    // Chip: white pill with a colored inset ring + colored text (matches the poster).
    ringColor: cluster.color,
    textColor: cluster.textColor,
    // Role badge: solid cluster color with white text (matches the poster). Uses the cluster color
    // rather than the accent so the foundation badges stay technical-purple, not the dark-slate accent.
    levelBadgeBg: cluster.textColor,
    levelBadgeText: "#ffffff",
  };
}

const TRACK_STYLE = {
  "foundation": buildTrackStyle(CLUSTERS.technical, "#0f172a"),
  "deep-technical": buildTrackStyle(CLUSTERS.technical),
  "product-focused": buildTrackStyle(CLUSTERS.product),
  "people-delivery": buildTrackStyle(CLUSTERS.operational),
};

function TrackRoleSequence({ roleLevels, badgeBg, badgeColor }) {
  return (
    <ol className="flex flex-col gap-1.5 justify-between">
      {roleLevels.map(({ level, title }) => (
        <li key={`${level}-${title}`} className="flex items-center gap-2">
          <LevelBadge level={level} backgroundColor={badgeBg} color={badgeColor} />
          <p className={cn("min-w-0 flex-1", DOC_TEXT.bodyDimMedium, "font-semibold")}>{title}</p>
        </li>
      ))}
    </ol>
  );
}

function ChartPanel({ levels, title, focusedPillars, className }) {
  return (
    <div className={className}>
      <StaticCompetencyChart
        levels={levels}
        title={title}
        // Focus-dimming applies only in text mode; the chart auto-disables it in emoji mode.
        focusedPillars={undefined}
        emojiMaxWidthPx={TRACK_CHART_EMOJI_MAX_WIDTH_PX}
        maxHeightPx={180}
        aria-label={`${title} competency profile`}
      />
    </div>
  );
}

function KeyPillarChips({ pillars, ringColor, textColor, flexRowMd = false }) {
  return (
    <div className={cn("flex flex-wrap content-start gap-1", flexRowMd && "flex-row sm:flex-col md:flex-row")}>
      {pillars.map((pillar) => (
        <span
          key={pillar}
          className={cn("rounded-full bg-white px-2.5 py-1 text-[9px] sm:text-[10px] md:text-[11px]", DOC_TEXT.chip, "font-bold")}
          style={{ color: textColor, boxShadow: `inset 0 0 0 1.5px ${ringColor}` }}
        >
          {pillar}
        </span>
      ))}
    </div>
  );
}

function FoundationalPhase() {
  const style = TRACK_STYLE.foundation;

  return (
    <article className={cn(cardClass, "overflow-hidden border-l-[3px] p-3")} style={{ borderLeftColor: style.accent, backgroundColor: style.chipBg }}>
      <div className="space-y-2.5">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{FOUNDATIONAL_PHASE.title}</h3>

        <div className="space-y-2">
          <p className={DOC_TEXT.bodyMedium}>{FOUNDATIONAL_PHASE.intro}</p>

          <KeyPillarChips pillars={FOUNDATIONAL_PHASE.technicalPillars} ringColor={style.ringColor} textColor={style.textColor} />
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-300/70 xs:-mx-2 xs:grid-cols-3 xs:divide-x xs:divide-y-0">
          {FOUNDATIONAL_PHASE.stageCharts.map((chart) => (
            <div key={chart.id} className="space-y-1.5 py-2 first:pt-0 last:pb-0 xs:px-2 xs:py-0">
              <ChartPanel levels={chart.levels} title={chart.title} className="p-2" />
              <div className="flex items-center justify-center gap-2 xs:justify-start">
                <LevelBadge level={chart.role.level} backgroundColor={style.levelBadgeBg} color={style.levelBadgeText} />
                <p className={cn("min-w-0", DOC_TEXT.bodyDimMedium, "font-semibold", "xs:flex-1")}>{chart.role.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CareerTrackCard({ track, number }) {
  const style = TRACK_STYLE[track.id] ?? TRACK_STYLE["deep-technical"];

  return (
    <article
      className={cn(cardClass, "flex flex-col gap-2.5 overflow-hidden border-l-[3px] p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid")}
      style={{ borderLeftColor: style.accent, backgroundColor: style.chipBg }}
    >
      <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")} style={{ color: style.accent }}>
        Track {number}: {track.name}
      </h3>

      <ChartPanel levels={track.levels} title={track.chartTitle ?? track.name} focusedPillars={track.keyFocusPillars} />

      <p className={DOC_TEXT.bodyMedium}>{track.summary}</p>

      <KeyPillarChips
        pillars={track.chipOrder ?? sortKeyFocusPillars(track.keyFocusPillars)}
        ringColor={style.ringColor}
        textColor={style.textColor}
        flexRowMd
      />

      <TrackRoleSequence roleLevels={track.roleLevels} badgeBg={style.levelBadgeBg} badgeColor={style.levelBadgeText} />
    </article>
  );
}

export function CareerTracks() {
  return (
    <div className="space-y-3">
      <div className="space-y-1 pt-1">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{JUNIOR_TO_SENIOR.title}</h3>
        <p className={DOC_TEXT.bodyMedium}>{JUNIOR_TO_SENIOR.intro}</p>
      </div>

      <FoundationalPhase />

      <div className="space-y-1 pt-1">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{SENIOR_FORK.title}</h3>
        <p className={DOC_TEXT.bodyMedium}>{SENIOR_FORK.intro}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-3 sm:grid-rows-[auto_auto_auto_auto_auto]">
        {CAREER_TRACK_PROFILES.map((track, index) => (
          <CareerTrackCard key={track.id} track={track} number={index + 1} />
        ))}
      </div>
    </div>
  );
}
