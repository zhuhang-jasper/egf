import { useEffect, useRef, useState } from "react";

import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { useMediaQuery } from "@/hooks/useMediaQuery";

import { CLUSTERS, FE_UI } from "@/constants";
import { CAREER_TRACK_PROFILES, FOUNDATIONAL_PHASE, JUNIOR_TO_SENIOR, SENIOR_FORK, sortKeyFocusPillars } from "@/constants/theory-data";
import { CARD_SHADOW } from "@/styles/card";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";

/**
 * Emoji-only spokes for the six columned radars; text pillar names outside this band.
 *
 * Keyed on the PAGE's width so all six swap together, since the six frames are not the same width. 640 must
 * stay in step with `sm:grid-cols-3` below. See docs/DECISIONS.md#career-radar-emoji-breakpoint.
 */
const TRACK_CHART_EMOJI_QUERY = "(min-width: 640px) and (max-width: 819px)";

/**
 * Whether the foundational phase shows its 3-up grid as the ON-SCREEN layout. Below this the carousel is
 * what the screen gets — but the grid is still rendered and still laid out, just out of flow, because paper
 * always wants all three stage charts. See the long note at the grid itself for the mechanics.
 *
 * A JS QUERY RATHER THAN `sm:hidden` / `hidden sm:grid`, AND PRINT IS THE WHOLE REASON. That pairing let CSS
 * pick between two rendered branches, which is fine on screen and silently broken on paper: `min-width`
 * queries in paged media measure the PAGE BOX. A4 portrait is 794px, so printing from ANY device revealed
 * the grid — and from a phone that branch had been `display: none` all session, so its canvases had never
 * been drawn (`useChartFrameFit` bails at width 0, correctly, since nothing is measurable there). Print got
 * three blank canvases and hid the carousel that actually had a radar in it. The foundational charts came
 * out missing, and the empty row they left behind is what pushed section IV onto a second sheet.
 *
 * 640 MUST STAY IN STEP with `sm` and with TRACK_CHART_EMOJI_QUERY's lower bound, for the reason given
 * there: the track-card grid below still switches at `sm:grid-cols-3`, so all three have to agree on where
 * the columned regime starts.
 */
const FOUNDATION_GRID_QUERY = "(min-width: 640px)";

// CARD_TINTED's edge treatment, but the bezel is per TRACK not per cluster, so these set it inline themselves.
const cardClass = `rounded-xl border-y-0 border-r-0 border-l-[3px] ${CARD_SHADOW}`;
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
  // `color`, not `textColor`: this paints the bezel and title, so it must match every other cluster card.
  const resolvedAccent = accent ?? cluster.color;
  return {
    accent: resolvedAccent,
    chipBg: cluster.surfaceBg,
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
 *  At sm and up the caller mounts the desktop 3-up grid instead of this (see FOUNDATION_GRID_QUERY) — this
 *  component is not rendered at all there, rather than rendered and hidden. */
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
    // NO `sm:hidden` — the caller mounts this only below `sm` (see FOUNDATION_GRID_QUERY), so hiding it by
    // breakpoint too would be saying the same thing twice, and saying it in the medium that got this wrong
    // in the first place: paper measures `sm` against the page box, not the device. Paper suppresses this
    // via the `print:hidden` wrapper the caller puts around it, in favour of the 3-up grid.
    <div className="flex flex-col gap-1">
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

function FoundationalPhase({ isVisible, emojiSpokes, gridLayout }) {
  const style = TRACK_STYLE.foundation;

  return (
    <article
      // `print:overflow-visible` so this card can be split across a page break — a clipped box is
      // monolithic in paged media and gets shunted whole to the next sheet (leaving a blank gap behind)
      // or allowed to overlap what follows. See the fuller note in CompetencyMatrix.
      className={cn(cardClass, "overflow-hidden p-3 print:overflow-visible")}
      style={{ borderLeftColor: style.accent, backgroundColor: style.chipBg }}
    >
      {/* `gap`, not `space-y`: gap only applies BETWEEN rendered flex items, and an ABSOLUTELY POSITIONED
          item is not one, so the out-of-flow grid below contributes no gap of its own. `space-y-*` sets
          margins by DOM position, which is why these two charts used to need a wrapper element to avoid a
          phantom gap.

          `relative` is what the off-screen grid anchors to. Its own `width` is explicit, so this is not what
          sizes it — it is what keeps it positioned against THIS CARD rather than the page, so it stays inside
          the ancestor whose `overflow-hidden` clips it. That clip is what stops a 762px box inside a ~320px
          phone card from reaching `body`'s `overflow-x: auto` and producing a horizontal scrollbar, so the
          card's existing `overflow-hidden` is load-bearing for this now — see the note at the grid. */}
      <div className="relative flex flex-col gap-2">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{FOUNDATIONAL_PHASE.title}</h3>

        <div className="flex flex-col gap-2">
          <p className={DOC_TEXT.bodyMedium}>{FOUNDATIONAL_PHASE.intro}</p>

          <KeyPillarChips pillars={FOUNDATIONAL_PHASE.technicalPillars} ringColor={style.ringColor} textColor={style.textColor} />
        </div>

        {/* THE 3-UP GRID IS ALWAYS MOUNTED AND ALWAYS LAID OUT, at every viewport, because ALL THREE STAGE
            CHARTS MUST PRINT — on paper this section is a reference document, and one stage of a three-stage
            progression is not the document. The carousel is the SCREEN affordance for small viewports only.

            `hidden`/`sm:grid` CANNOT EXPRESS THAT, and that pairing is the bug this replaces. A chart in a
            `display: none` box has no width, `useChartFrameFit` bails at width 0 (correctly — nothing is
            measurable there), and the canvas is never drawn. Print then resolves `sm` against the PAGE box
            (A4 portrait is 794px, so it matches at any device), revealed the grid, and got three blank
            canvases — while the carousel that did have a drawn radar was hidden by its own `sm:hidden`.
            Below `sm` the grid is therefore taken OUT OF FLOW rather than out of layout: `absolute` +
            `invisible` keeps a real, non-zero width, so the fit runs and the three radars are drawn and kept
            current, while costing no vertical space and painting nothing. `pointer-events-none` and
            `aria-hidden` so an off-screen copy is neither tappable nor announced twice — the carousel is the
            accessible presentation at these widths, and it carries the same three charts.

            `print:static` puts it back in flow for paper at ALL widths (not `sm:`-gated — printing from a
            phone is exactly the case that was broken), and the carousel takes `print:hidden` so the two never
            both appear. Note the asymmetry is deliberate: the grid is conditionally POSITIONED, the carousel
            is conditionally MOUNTED. Only the grid has canvases that must stay warm for print.

            `print:break-inside-avoid` — this row is three radars plus their role labels, ~250px, so it
            either fits or moves as a unit. Without it a page break lands mid-radar. */}
        <div
          data-print-foundation-grid
          aria-hidden={!gridLayout}
          /* OFF-SCREEN IT IS LAID OUT AT THE PRINTED WIDTH, not the card's — the single most important part
             of this whole arrangement. A radar's geometry (radius, axis-label size, label padding) is derived
             from the width it fitted at and baked into the drawn bitmap; print CSS can rescale that bitmap but
             cannot re-derive it. Left at the phone's ~320px card width this row printed three ~100px radars
             with clipped pillar names, next to track cards that looked right purely because they are in flow
             and were always laid out full-width. So the off-screen copy is pinned to the width paper will give
             it, and prints at the size it was built for. `inset-x-0` is dropped in that state: it would stretch
             the box back to the card's width and undo exactly this. */
          style={gridLayout ? undefined : { width: FE_UI.page.printFoundationGridWidthPx }}
          className={cn(
            "-mx-2 grid grid-cols-3 divide-x divide-slate-300/70 print:break-inside-avoid",
            !gridLayout && "pointer-events-none invisible absolute left-0 top-0 print:visible print:static",
          )}
        >
          {FOUNDATIONAL_PHASE.stageCharts.map((chart) => (
            <div key={chart.id} className="flex flex-col gap-2 px-2">
              <FoundationStageBody chart={chart} style={style} emojiSpokes={emojiSpokes} />
            </div>
          ))}
        </div>

        {!gridLayout && (
          <div className="print:hidden">
            <FoundationCarousel stageCharts={FOUNDATIONAL_PHASE.stageCharts} style={style} isVisible={isVisible} emojiSpokes={emojiSpokes} />
          </div>
        )}
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
        "flex flex-col gap-3 overflow-hidden p-3 sm:row-span-5 sm:grid sm:grid-rows-subgrid print:overflow-visible print:break-inside-avoid",
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
  // Which foundational layout MOUNTS (not merely which one is visible) — see FOUNDATION_GRID_QUERY.
  const foundationGridLayout = useMediaQuery(FOUNDATION_GRID_QUERY);

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

      <FoundationalPhase isVisible={isVisible} emojiSpokes={emojiSpokes} gridLayout={foundationGridLayout} />

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
