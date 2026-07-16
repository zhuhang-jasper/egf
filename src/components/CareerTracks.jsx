import { useEffect, useRef, useState } from "react";

import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { useMediaQuery } from "@/hooks/useMediaQuery";

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

function ChartPanel({ levels, title, focusedPillars, className, animateDataChanges = false }) {
  return (
    <div className={className}>
      <StaticCompetencyChart
        levels={levels}
        title={title}
        // Focus-dimming applies only in text mode; the chart auto-disables it in emoji mode.
        focusedPillars={undefined}
        emojiMaxWidthPx={TRACK_CHART_EMOJI_MAX_WIDTH_PX}
        maxHeightPx={180}
        animateDataChanges={animateDataChanges}
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

/** The chart + role-label body for one foundational stage. Shared by the desktop 3-up grid
 *  (left-aligned role row) and the mobile carousel (centered under the centered chart). */
function FoundationStageBody({ chart, style, centerRole = false, animateChart = false }) {
  return (
    <>
      <ChartPanel levels={chart.levels} title={chart.title} className="p-2" animateDataChanges={animateChart} />
      <div className={cn("flex items-center gap-2", centerRole ? "justify-center" : "justify-start")}>
        <LevelBadge level={chart.role.level} backgroundColor={style.levelBadgeBg} color={style.levelBadgeText} />
        <p className={cn("min-w-0", DOC_TEXT.bodyDimMedium, "font-semibold", !centerRole && "flex-1")}>{chart.role.title}</p>
      </div>
    </>
  );
}

/** Mobile-only (<xs): one chart at a time with a centered horizontal L1/L2/L3 badge selector above
 *  it, so the chart stays centered. Tapping a level swaps the chart. Starts on the first stage (L1).
 *  At xs and up the desktop 3-up grid is shown instead (this whole block is `xs:hidden`). */
// How long each stage stays on screen before the carousel auto-advances to the next.
const FOUNDATION_AUTOPLAY_MS = 1400;
// After the user taps a stage, autoplay pauses this long before resuming (so it doesn't immediately
// yank them off their choice, but the loop still comes back on its own).
const FOUNDATION_RESUME_MS = 7000;

function FoundationCarousel({ stageCharts, style }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Autoplay pauses when the user taps a stage, then resumes after FOUNDATION_RESUME_MS of no taps.
  const [paused, setPaused] = useState(false);
  // Users who ask for reduced motion never get the auto-advance loop.
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const resumeTimerRef = useRef(null);
  const activeChart = stageCharts[activeIndex];

  useEffect(() => {
    if (paused || prefersReducedMotion) {
      return undefined;
    }
    const id = setInterval(() => setActiveIndex((prev) => (prev + 1) % stageCharts.length), FOUNDATION_AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, prefersReducedMotion, stageCharts.length]);

  // Clear the pending resume timer on unmount.
  useEffect(() => () => clearTimeout(resumeTimerRef.current), []);

  const selectStage = (index) => {
    setActiveIndex(index);
    if (prefersReducedMotion) {
      return;
    }
    setPaused(true);
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setPaused(false), FOUNDATION_RESUME_MS);
  };

  return (
    <div className="space-y-1 xs:hidden">
      <div className="flex justify-center gap-1.5 pt-1" role="tablist" aria-label="Foundational stage">
        {stageCharts.map((chart, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={chart.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${chart.role.level} ${chart.role.title}`}
              onClick={() => selectStage(index)}
              className={cn(levelBadgeClass, "cursor-pointer px-2 py-1 transition-opacity", !isActive && "opacity-35")}
              style={{ backgroundColor: style.levelBadgeBg, color: style.levelBadgeText }}
            >
              {chart.role.level}
            </button>
          );
        })}
      </div>

      {/* One persistent chart. Changing the active stage only swaps the dataset values, which
          Chart.js tweens (animateChart) — the radar points ease to their new spots while the base
          geometry and labels stay put. No stacked canvases; the role label below swaps instantly.
          Reduced-motion users get an instant value swap (no tween). */}
      <div className="space-y-1.5">
        <FoundationStageBody chart={activeChart} style={style} centerRole animateChart={!prefersReducedMotion} />
      </div>
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

        {/* Carousel (mobile) and 3-up grid (xs+) are wrapped together. `space-y-2.5` on the parent
            applies `margin-bottom` to every child *except the DOM `:last-child`* — and `:last-child`
            ignores `display:none`, so toggling the two with `hidden` would leave whichever comes
            first with a phantom bottom margin against its hidden sibling. Wrapping them in a single
            child avoids that: the wrapper is the last child, so no stray gap below it. */}
        <div>
          <FoundationCarousel stageCharts={FOUNDATIONAL_PHASE.stageCharts} style={style} />

          <div className="-mx-2 hidden grid-cols-3 divide-x divide-slate-300/70 xs:grid">
            {FOUNDATIONAL_PHASE.stageCharts.map((chart) => (
              <div key={chart.id} className="space-y-1.5 px-2">
                <FoundationStageBody chart={chart} style={style} />
              </div>
            ))}
          </div>
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
