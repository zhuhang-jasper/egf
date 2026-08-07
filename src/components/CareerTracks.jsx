import { useEffect, useRef, useState } from "react";

import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { useMediaQuery } from "@/hooks/useMediaQuery";

import { CLUSTERS, getClusterSurfaceBg } from "@/constants";
import { CAREER_TRACK_PROFILES, FOUNDATIONAL_PHASE, JUNIOR_TO_SENIOR, SENIOR_FORK, sortKeyFocusPillars } from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";

/**
 * The 640–819px band, and the only place the six columned radars decide between emoji-only spokes and
 * full text pillar names. Inside it they show emoji; outside it, text.
 *
 * ALL SIX SWAP TOGETHER because this is a property of the PAGE's width — the same fact that decides the
 * layout regime — evaluated once. They used to carry a px threshold that each chart compared against its
 * OWN canvas width (`emojiMaxWidthPx = 220`), and the six frames are not the same width: a career-track
 * card's chart runs 176→263px across the columned range while a foundational cell's runs 170→257px (it
 * carries the divided grid's extra `px-2` plus ChartPanel's `p-2`). So the two groups crossed 220 about
 * 20 viewport px apart — at ~772 the track cards went to text while the foundation row was still emoji —
 * and scrollbar width shifted both.
 *
 * Written out as numbers because matchMedia takes a string and the theme is `@theme inline` (see
 * index.css), which substitutes values into the generated utilities instead of emitting
 * `--breakpoint-*` on `:root` — so there is nothing to read Tailwind's scale from at runtime.
 *
 *   640 — the lower bound, Tailwind's `sm`, and it MUST stay in step with `sm:grid-cols-3` below. Under
 *     it the cards stack and every chart is full-width (286–591px), which fits text comfortably, so
 *     emoji is confined to the columned view and never reaches mobile.
 *   820 — the upper bound, and the one value here tuned to a device rather than a breakpoint: it is the
 *     iPad Air's portrait width, the narrowest screen we want reading full pillar names. So the query
 *     caps at 819 and text starts exactly at 820, where the columns are ~230–236px wide. Raise it to
 *     hold emoji further up; drop it to 640 for text everywhere, at the cost of 9 pillar names at the
 *     8px floor around a 170px chart in the narrowest column.
 */
const TRACK_CHART_EMOJI_QUERY = "(min-width: 640px) and (max-width: 819px)";

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

function ChartPanel({ levels, title, focusedPillars, className, animateDataChanges = false, emojiSpokes = false }) {
  return (
    <div className={className}>
      <StaticCompetencyChart
        levels={levels}
        title={title}
        // Focus-dimming applies only in text mode; the chart auto-disables it in emoji mode.
        focusedPillars={undefined}
        emojiOnlyLabels={emojiSpokes}
        maxHeightPx={180}
        animateDataChanges={animateDataChanges}
        aria-label={`${title} competency profile`}
      />
    </div>
  );
}

function KeyPillarChips({ pillars, ringColor, textColor, flexRowMd = false }) {
  /* `data-print-chip-row` forces the wrapping row on paper — see index.css.
     `sm:flex-col md:flex-row` puts a ONE-PILL-PER-LINE column in the 640–767px band, which is a sensible
     screen rule (that is the width where a track card is a narrow column) and a trap in print: the page box
     is what those queries measure there, so a couple of millimetres of margin decides whether a track's
     chips set as 2 lines or 4. Paper has no reason to consult a viewport breakpoint. */
  return (
    <div data-print-chip-row className={cn("flex flex-wrap content-start gap-1", flexRowMd && "flex-row sm:flex-col md:flex-row")}>
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
function FoundationStageBody({ chart, style, centerRole = false, animateChart = false, emojiSpokes = false }) {
  return (
    <>
      <ChartPanel levels={chart.levels} title={chart.title} className="p-2" animateDataChanges={animateChart} emojiSpokes={emojiSpokes} />
      <div className={cn("flex items-center gap-2", centerRole ? "justify-center" : "justify-start")}>
        <LevelBadge level={chart.role.level} backgroundColor={style.levelBadgeBg} color={style.levelBadgeText} />
        <p className={cn("min-w-0", DOC_TEXT.bodyDimMedium, "font-semibold", !centerRole && "flex-1")}>{chart.role.title}</p>
      </div>
    </>
  );
}

/** Mobile-only (<sm): one chart at a time with a centered horizontal S1/S2/S3 badge selector above
 *  it, so the chart stays centered. Tapping a level swaps the chart. Starts on the first stage (S1).
 *  At sm and up the desktop 3-up grid is shown instead (this whole block is `sm:hidden`). */
// How long each stage stays on screen before the carousel auto-advances to the next.
const FOUNDATION_AUTOPLAY_MS = 1400;
// After the user taps a stage, autoplay pauses this long before resuming (so it doesn't immediately
// yank them off their choice, but the loop still comes back on its own).
const FOUNDATION_RESUME_MS = 7000;

function FoundationCarousel({ stageCharts, style, isVisible = true, emojiSpokes = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Autoplay pauses when the user taps a stage, then resumes after FOUNDATION_RESUME_MS of no taps.
  const [paused, setPaused] = useState(false);
  // Users who ask for reduced motion never get the auto-advance loop.
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const resumeTimerRef = useRef(null);
  const activeChart = stageCharts[activeIndex];

  // `isVisible` GATES THE LOOP, and it is the reason this is not just a nicety. The theory tab stays
  // mounted while the tool tab is on screen, so without it this kept advancing forever — a 500ms
  // Chart.js data tween every 1.4s, on a canvas nobody was looking at, for as long as the page was
  // open. It is also off during the boot prefit pass, since that runs with the tab still inactive.
  useEffect(() => {
    if (!isVisible || paused || prefersReducedMotion) {
      return undefined;
    }
    const id = setInterval(() => setActiveIndex((prev) => (prev + 1) % stageCharts.length), FOUNDATION_AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isVisible, paused, prefersReducedMotion, stageCharts.length]);

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
    <div className="flex flex-col gap-1 sm:hidden">
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
              className={cn(levelBadgeClass, "cursor-pointer select-none px-2 py-1 transition-opacity", !isActive && "opacity-35")}
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
      <div className="flex flex-col gap-2">
        <FoundationStageBody chart={activeChart} style={style} centerRole animateChart={!prefersReducedMotion} emojiSpokes={emojiSpokes} />
      </div>
    </div>
  );
}

function FoundationalPhase({ isVisible, emojiSpokes }) {
  const style = TRACK_STYLE.foundation;

  return (
    <article
      // `print:overflow-visible` so this card can be split across a page break — a clipped box is
      // monolithic in paged media and gets shunted whole to the next sheet (leaving a blank gap behind)
      // or allowed to overlap what follows. See the fuller note in CompetencyMatrix.
      className={cn(cardClass, "overflow-hidden border-l-[3px] p-3 print:overflow-visible")}
      style={{ borderLeftColor: style.accent, backgroundColor: style.chipBg }}
    >
      {/* `gap`, not `space-y`: gap only applies BETWEEN rendered flex items, so the breakpoint-hidden
          chart branch below contributes nothing. `space-y-*` sets margins by DOM position, which is
          why these two charts used to need a wrapper element to avoid a phantom gap. */}
      <div className="flex flex-col gap-2">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{FOUNDATIONAL_PHASE.title}</h3>

        <div className="flex flex-col gap-2">
          <p className={DOC_TEXT.bodyMedium}>{FOUNDATIONAL_PHASE.intro}</p>

          <KeyPillarChips pillars={FOUNDATIONAL_PHASE.technicalPillars} ringColor={style.ringColor} textColor={style.textColor} />
        </div>

        <FoundationCarousel stageCharts={FOUNDATIONAL_PHASE.stageCharts} style={style} isVisible={isVisible} emojiSpokes={emojiSpokes} />

        {/* `print:break-inside-avoid` — this row is three radars plus their role labels, ~250px, so it
            either fits or moves as a unit. Without it a page break lands mid-radar. */}
        <div className="-mx-2 hidden grid-cols-3 divide-x divide-slate-300/70 sm:grid print:break-inside-avoid">
          {FOUNDATIONAL_PHASE.stageCharts.map((chart) => (
            <div key={chart.id} className="flex flex-col gap-2 px-2">
              <FoundationStageBody chart={chart} style={style} emojiSpokes={emojiSpokes} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function CareerTrackCard({ track, number, emojiSpokes }) {
  const style = TRACK_STYLE[track.id] ?? TRACK_STYLE["deep-technical"];

  return (
    <article
      // `print:break-inside-avoid` because a track card is well under a page: splitting one would put its
      // radar on one sheet and the roles it belongs to on the next. `print:overflow-visible` for the
      // paged-media clipping reason documented in CompetencyMatrix.
      className={cn(
        cardClass,
        "flex flex-col gap-3 overflow-hidden border-l-[3px] p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid print:overflow-visible print:break-inside-avoid",
      )}
      style={{ borderLeftColor: style.accent, backgroundColor: style.chipBg }}
    >
      <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")} style={{ color: style.accent }}>
        Track {number}: {track.name}
      </h3>

      <ChartPanel levels={track.levels} title={track.chartTitle ?? track.name} focusedPillars={track.keyFocusPillars} emojiSpokes={emojiSpokes} />

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

export function CareerTracks({ isVisible = true }) {
  // Evaluated ONCE here and handed to all six charts, which is what makes them swap on the same pixel
  // instead of each deciding from its own width — see TRACK_CHART_EMOJI_QUERY.
  const emojiSpokes = useMediaQuery(TRACK_CHART_EMOJI_QUERY);

  return (
    <div className="flex flex-col gap-3">
      {/* `DOC_SECTION.intro`, not a `DOC_TEXT.body*` token. Both subsection lead-ins sit on the page rather
          than inside a card, so they take the page grey under the surface rule in doc-typography.js. They
          were `bodyMedium`, the CARD grey — identical size, but lighter than the Section IV intro
          directly above, which made the section look like it dimmed one step past its own opening line.
          Weight carries the distinction between the h3 and its paragraph; color does not need to. */}
      <div className="flex flex-col gap-1 pt-1">
        <h3 className={cn(DOC_TEXT.subsectionTitle, "font-bold")}>{JUNIOR_TO_SENIOR.title}</h3>
        <p className={DOC_SECTION.intro}>{JUNIOR_TO_SENIOR.intro}</p>
      </div>

      <FoundationalPhase isVisible={isVisible} emojiSpokes={emojiSpokes} />

      <div className="flex flex-col gap-1 pt-1">
        <h3 className={cn(DOC_TEXT.subsectionTitle, "font-bold")}>{SENIOR_FORK.title}</h3>
        <p className={DOC_SECTION.intro}>{SENIOR_FORK.intro}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-3 sm:grid-rows-[auto_auto_auto_auto_auto]">
        {CAREER_TRACK_PROFILES.map((track, index) => (
          <CareerTrackCard key={track.id} track={track} number={index + 1} emojiSpokes={emojiSpokes} />
        ))}
      </div>
    </div>
  );
}
