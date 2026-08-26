import { useCallback, useEffect, useRef, useState } from "react";

import { Printer, ScrollText, Share2 } from "lucide-react";

import { AdminLockBadge } from "@/components/AdminLockBadge";
import { CareerTracks } from "@/components/CareerTracks";
import { ChangelogModal } from "@/components/ChangelogModal";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { MalaysiaFlag } from "@/components/MalaysiaFlag";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";
import { UnseenDot } from "@/components/UnseenDot";

import { useFitsOneLine } from "@/hooks/useFitsOneLine";
import { getSectionSentinelId, useSectionSeenObserver } from "@/hooks/useSectionSeenObserver";

import { getChartTitleSizePx } from "@/chart/fonts";
import { FE_UI, FRAMEWORK_VERSION, IS_ADMIN, SITE_COPY } from "@/constants";
import {
  COMPETENCY_MATRIX,
  COMPETENCY_MATRIX_INTRO,
  getSkillTierBands,
  SENIORITY_LEVEL_DEFINITIONS,
  SKILL_TIERS_CAPTION,
  SKILL_TIERS_INTRO,
  THEORY_SECTION_COPY,
} from "@/constants/theory-data";
import { CARD_PLAIN } from "@/styles/card";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { TOOLBAR_SURFACE } from "@/styles/toolbar";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { shareTheoryLink } from "@/utils/copy-chart-image";
import { scrollBelowStickyHeaderUntilSettled, scrollWindowToTop } from "@/utils/scroll";
import {
  buildTheoryShareUrl,
  getPersistedExpandedPillar,
  getPillarCardElementId,
  persistExpandedPillar,
  THEORY_SECTION_IDS,
  THEORY_SECTIONS,
} from "@/utils/theory-url";

const cardClass = CARD_PLAIN;

/**
 * Whether the OS share sheet can be opened at all. A plain `navigator.share` check, deliberately NOT the
 * `canShare({ files })` probe gating the chart's Share button: the link is the payload here, so gating on file
 * support would hide the button from browsers that can still deliver it.
 */
const CAN_SHARE_LINK = typeof navigator !== "undefined" && typeof navigator.share === "function";

// Stable fallback for the unseen-sections prop, so a caller that omits it doesn't hand the observer
// a fresh Set identity on every render.
const NO_UNSEEN_SECTIONS = new Set();
const noop = () => {};
const returnsFalse = () => false;

const SKILL_TIER_BANDS = getSkillTierBands();

// Opening the first pillar on a fresh visit stops the section reading as a second copy of the Section I
// pillar grid with the 45 cells nowhere on screen. Read from the data, so it follows the authored order.
const DEFAULT_EXPANDED_PILLAR = COMPETENCY_MATRIX[0].pillarId;

/**
 * The expanded pillar to boot with. A stored empty string wins over the default (user closed it on purpose),
 * and a pillar deep-link suppresses it too, since the staged effect below overrides it once restore settles.
 */
function getInitialExpandedPillar(deepLink) {
  const persisted = getPersistedExpandedPillar();
  if (persisted !== null) {
    return persisted || null;
  }

  const deepLinkPillar = deepLink?.section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
  return deepLinkPillar ? null : DEFAULT_EXPANDED_PILLAR;
}

// Shared with the tool chart (FE_UI.chart.pointLabelPxRange); stable module identity because
// StaticCompetencyChart memoizes on this object.
const HERO_POINT_LABEL_PX_RANGE = FE_UI.chart.pointLabelPxRange;

// Long enough to clear scroll-restore's initial frames, short enough that the transition still feels prompt.
const DEEPLINK_RESTORE_SETTLE_MS = 350;
// Matches the `duration-300` on the matrix panel; waited out so the card has stopped moving before we
// measure and glide.
const DEEPLINK_EXPAND_ANIM_MS = 300;

/**
 * Zero-height marker bracketing a section's content, read by `useSectionSeenObserver`. MUST stay IN FLOW: its
 * document position IS the signal, and `absolute` collapses both sentinels onto the section's origin. Flex
 * then charges `gap` for a zero-height child, which `gapClass` cancels per section since the parents do not
 * share a gap.
 */
function SectionSentinel({ section, edge, gapClass }) {
  return <span id={getSectionSentinelId(section, edge)} aria-hidden className={cn("block h-0 w-full shrink-0", gapClass)} />;
}

function SectionHeading({ title, subtitle, section, hasUnseenUpdates = false }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* The dot rides the title text as a superscript rather than sitting after the share button,
            so it reads as belonging to the heading. `self-start` + `mt-1` place it near the cap
            height of the first line instead of centring it against a wrapped two-line title. */}
        <h2 className={cn(DOC_SECTION.title, "flex items-start gap-1")}>
          {title}
          {hasUnseenUpdates ? <UnseenDot label={`Updated in v${FRAMEWORK_VERSION}`} className="mt-1 size-2 self-start" /> : null}
        </h2>
        <ShareLinkButton section={section} ariaLabel="Copy link to this content" />
      </div>
      {subtitle ? <p className={DOC_SECTION.intro}>{subtitle}</p> : null}
    </header>
  );
}

const levelBadgeClass = "flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white";

/**
 * Renders a "Quality / Identity" phase title. `breakAfterSlash` forces a break for the cramped 5-column
 * grid; left off in the mobile stacked view, which has ample horizontal room.
 */
function SeniorityPhaseTitle({ phase, className, breakAfterSlash = false }) {
  const [quality, identity] = phase.split(" / ");
  return (
    <p className={className}>
      {identity && breakAfterSlash ? (
        <>
          {quality} /<br />
          {identity}
        </>
      ) : (
        phase
      )}
    </p>
  );
}

/**
 * The three cumulative skill tiers as staggered bands across the L1-L5 axis, each starting at the MIDPOINT of
 * the one before. The overlap is the point of the diagram, so the stagger is kept at every width rather than
 * degrading to a stacked list. ONE layout at all sizes, bound by the narrowest band since it carries the
 * longest label: if a label looks cramped, widen the band in `SKILL_TIERS` rather than shrinking the type.
 * Ruler and bands are both percentages of this card's OWN track, so they stay exact against each other.
 */
function SkillTierBands() {
  return (
    <div className={cn(cardClass, "p-3")}>
      {/* Ruler: five equal 20% cells naming the axis the bands below are measured against. Both are plain
          percentages of this one track — see the docblock for what was dropped when this card stopped
          sitting under the five level cards. */}
      <div className="grid grid-cols-5 border-b border-slate-200 pb-1">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          // The in-card grey (see doc-typography.js), hardcoded because `badgeMicro` carries no color of its
          // own. Keep it in step if that grey moves.
          <span key={code} className={cn("text-center", DOC_TEXT.badgeMicro, "text-slate-600")}>
            {code}
          </span>
        ))}
      </div>

      {/* Normal flow rows, indented with a margin rather than absolutely positioned, so the
          track's height comes from its content and the row gap is just the flex `gap`. A margin (not a
          grid column) is what lets an edge land mid-column. */}
      <div className="mt-1.5 flex flex-col gap-1 sm:gap-2">
        {SKILL_TIER_BANDS.map(({ id, label, startPct, widthPct, bandClass }) => (
          <div
            key={id}
            // These labels are content, not a heading. `bandClass` stays last so the tier's color beats the
            // token's `text-slate-800`.
            className={cn(
              // `px-2` at sm and up, not `px-3`: the widest label ("Foundational") sits in the NARROWEST
              // band, so horizontal padding is charged against the tightest budget on the track.
              "flex items-center justify-center rounded-md px-1.5 py-1 italic sm:rounded-lg sm:px-2 sm:py-1.5",
              DOC_TEXT.bodySemibold,
              bandClass,
            )}
            // `minWidth: max-content` guards the label and wins over exact positioning where it binds.
            style={{
              marginLeft: `${startPct}%`,
              width: `${widthPct}%`,
              minWidth: "max-content",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* The captions rung: 11px and one shade below in-card body, so this reads as annotation
          on the figure rather than as another paragraph of the section's prose. */}
      <p className={cn("mt-2 border-t border-slate-200 pt-2", DOC_TEXT.metaBody)}>{SKILL_TIERS_CAPTION}</p>
    </div>
  );
}

// Mutually exclusive breakpoint views of the same five levels, so a fragment is enough.
function SeniorityStepper() {
  return (
    <>
      <div className="flex flex-col gap-2 sm:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description }) => (
          <div key={code} className={cn(cardClass, "flex items-center gap-2 p-3")}>
            <span className={cn(levelBadgeClass, "size-7", DOC_TEXT.badgeMd)}>{code}</span>
            <div className="flex min-w-0 flex-col gap-2">
              <SeniorityPhaseTitle phase={phase} className={cn("min-w-0", DOC_TEXT.cardTitle, "font-bold")} />
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        {/* Three shared rows declared on the track, each card a `grid-rows-subgrid` spanning all three, so
            every row is sized by the tallest card and the parts line up across all five columns.
            `breakAfterSlash` makes the title band a uniform two lines rather than letting each column wrap
            wherever it runs out of width. */}
        <div className="grid grid-cols-5 grid-rows-[repeat(3,auto)] gap-2">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description }) => (
            <div key={code} className={cn(cardClass, "row-span-3 grid min-w-0 grid-rows-subgrid items-start gap-y-2 p-3")}>
              <div className="flex justify-start">
                <span className={cn(levelBadgeClass, "size-7 shrink-0", DOC_TEXT.badgeMd)}>{code}</span>
              </div>
              <SeniorityPhaseTitle phase={phase} breakAfterSlash className={cn("min-w-0", DOC_TEXT.cardTitle, "font-bold")} />
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TheoryContent({
  deepLink,
  onDeepLinkConsumed,
  matrixNav,
  cancelRestoreRef,
  isVisible = true,
  unseenSections = NO_UNSEEN_SECTIONS,
  markSectionEdgeSeen = noop,
  isSectionEdgePairComplete = returnsFalse,
  markSectionSeen = noop,
}) {
  const consumedRef = useRef(false);
  const taglineProbeRef = useRef(null);
  const taglineFitsOneLine = useFitsOneLine(taglineProbeRef, isVisible);

  // Observes only the still-unseen sections, so this is inert for a caught-up user.
  useSectionSeenObserver(isVisible, unseenSections, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen);

  // Expanded pillar state lives here so the matrix share button can read it.
  // See docs/DECISIONS.md#theory-deeplink-boot-order for why this starts from the PERSISTED pillar.
  const [expandedPillar, setExpandedPillar] = useState(() => getInitialExpandedPillar(deepLink));

  // Permanently off: the `**…**` markers stay in the copy for future use, but the page toggle is now the
  // "Show changelog" button.
  const [changelogOpen, setChangelogOpen] = useState(false);

  // The hero radar's measured frame width, which sizes the title above it. `useCallback` because an inline
  // arrow would refire the notify effect on every render of this tab.
  const [heroChartWidth, setHeroChartWidth] = useState(0);
  const handleHeroFrameWidth = useCallback((width) => setHeroChartWidth(width), []);

  // Expanding the pillar is what makes CompetencyMatrix scroll to it. Keyed on `seq` so clicking the same
  // pillar again re-runs, where a no-op state change would not.
  const matrixNavSeq = matrixNav?.seq;
  useEffect(() => {
    const pillarId = matrixNav?.pillarId;
    if (!pillarId) {
      return;
    }
    persistExpandedPillar(pillarId);
    setExpandedPillar(pillarId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixNavSeq]);

  // Chromium positions the fixed running footer relative to the scroll offset when print starts, not
  // per-page, so printing from partway down loses it on some sheets. `beforeprint` fires however print was
  // triggered, so this is the one place that catches all of them.
  // See docs/DECISIONS.md#print-running-footer
  useEffect(() => {
    const handleBeforePrint = () => scrollWindowToTop();
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  useEffect(() => {
    if (!deepLink || consumedRef.current) {
      return undefined;
    }

    const { section } = deepLink;
    if (!section) {
      onDeepLinkConsumed?.();
      consumedRef.current = true;
      return undefined;
    }

    const sectionId = THEORY_SECTION_IDS[section];
    if (!sectionId) {
      onDeepLinkConsumed?.();
      consumedRef.current = true;
      return undefined;
    }

    // A pillar deep-link aims at the expanded card, not the section heading.
    const targetPillar = section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
    const targetId = targetPillar ? getPillarCardElementId(targetPillar) : sectionId;

    // Staged so a shared link reads as navigation rather than a teleport: double rAF to let the hidden panel
    // lay out and restore land, then the pillar switch (`cancelRestoreRef` flipping so restore stops
    // re-asserting against the expand), then a re-aim until the card stops moving before the glide. A single
    // scroll would land short, the old pillar still collapsing above it.
    let settleTimer = null;
    let glideTimer = null;
    let inner = null;
    let cancelSettled = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        settleTimer = setTimeout(() => {
          if (cancelRestoreRef) {
            cancelRestoreRef.current = true; // restore done — stop it before the expand shifts layout
          }
          if (targetPillar) {
            persistExpandedPillar(targetPillar);
            setExpandedPillar(targetPillar);
          }
          glideTimer = setTimeout(() => {
            const el = document.getElementById(targetId) ?? document.getElementById(sectionId);
            if (el) {
              cancelSettled = scrollBelowStickyHeaderUntilSettled(el);
            }
            onDeepLinkConsumed?.();
            consumedRef.current = true;
          }, DEEPLINK_EXPAND_ANIM_MS);
        }, DEEPLINK_RESTORE_SETTLE_MS);
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) {
        cancelAnimationFrame(inner);
      }
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
      }
      if (glideTimer !== null) {
        clearTimeout(glideTimer);
      }
      cancelSettled?.();
    };
    // deepLink and onDeepLinkConsumed are stable boot-time values — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Hands the theory tab's URL plus the pillar poster image to the OS share sheet. The plain `?tab=theory`
   * link, because this is the tab-level control: it shares the document, not the reader's scroll position.
   * No toast either way, the sheet being its own feedback and a dismissal a decision rather than an error.
   */
  const handleShareTheory = async () => {
    const result = await shareTheoryLink(buildTheoryShareUrl(null, null));
    if (result.ok) {
      track("theory_shared", { method: result.method });
    }
  };

  return (
    <>
      {/* Toolbar row: page actions at the left, changelog at the right. OUTSIDE the sections column, and its
          spacing must stay in step with the tool tab's export group.
          See docs/DECISIONS.md#tab-toolbars-state-their-spacing-identically */}
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        {/* `gap-2` matches the tool tab's export group (ChartToolbar's ExportMenu). This group is commonly
            EMPTY, which needs no special case.
            See docs/DECISIONS.md#tab-toolbars-state-their-spacing-identically */}
        <div className="flex items-center gap-2">
          {/* PRINT, ADMIN ONLY — the button is gated, the printed output is not.
              `group relative` + `<Tooltip>` rather than a native `title`: one tooltip mechanism across the app.
              See docs/DECISIONS.md#tab-toolbars-state-their-spacing-identically */}
          {IS_ADMIN ? (
            <Button
              type="button"
              variant="outline"
              shape="pill"
              onClick={() => {
                track("theory_printed");
                window.print();
              }}
              aria-label="Print the framework"
              className={cn(TOOLBAR_SURFACE, "group relative gap-1")}
            >
              <Printer className="size-3.5 shrink-0" aria-hidden />
              Print
              {/* Offsets differ from the nav's because a pill's corner is a curve, not a right angle: the same
                  numbers would sit outside the radius. TOP-RIGHT is where the tooltip is not, it opening below
                  this button. Keeps its `label`, unlike the menu rows, there being no wrapping <label> whose
                  accessible name would absorb it. */}
              <AdminLockBadge className="-top-0.5 -right-1" />
              <Tooltip text="Print the framework" placement="bottom" />
            </Button>
          ) : null}

          {/* SHARE, WHERE THE OS CAN. Conditional on `CAN_SHARE_LINK` (see above), which in practice means
              mobile: the share sheet is how a link leaves the browser on a phone, where there is no
              "copy the URL bar" gesture worth the name. Desktop readers lose nothing — the copy-link icon
              on every section heading is the same URL by another route. */}
          {CAN_SHARE_LINK ? (
            <Button
              type="button"
              variant="outline"
              shape="pill"
              onClick={handleShareTheory}
              aria-label="Share the framework"
              className={cn(TOOLBAR_SURFACE, "group relative gap-1")}
            >
              <Share2 className="size-3.5 shrink-0" aria-hidden />
              Share
              <Tooltip text="Share the framework" placement="bottom" />
            </Button>
          ) : null}
        </div>
        {/* THE VERSION RIDES THE CHANGELOG BUTTON: the `aria-label`, the sibling-span middot and `tabular-nums`
            all follow from the label being two runs and a separator.
            See docs/DECISIONS.md#the-version-rides-the-changelog-button */}
        <Button
          type="button"
          variant="outline"
          shape="pill"
          onClick={() => {
            // The version the reader was ON when they opened it, the same param `theory_section_seen` carries,
            // so the pair answers whether a release is what drives people to read what changed.
            track("changelog_opened", { framework_version: FRAMEWORK_VERSION });
            setChangelogOpen(true);
          }}
          aria-label={`Changelog, currently on version ${FRAMEWORK_VERSION}`}
          className="gap-1"
        >
          <ScrollText className="size-3.5 shrink-0" aria-hidden />
          Changelog
          <span aria-hidden className="text-slate-400">
            ·
          </span>
          {/* `font-normal` against the label's inherited weight, and `text-slate-500` against its darker ink:
              the version qualifies "Changelog" rather than sharing billing with it. This is the same demotion
              the bottom nav's version span makes, by the same two properties. */}
          <span aria-hidden className="font-normal tabular-nums text-slate-500">
            v{FRAMEWORK_VERSION}
          </span>
        </Button>
      </div>

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {/* THE SECTIONS COLUMN. `gap-6` here means one thing only: the distance between the cover and the four
          numbered sections, and between those sections. Nothing that is not one of those five belongs in it. */}
      <div className="flex flex-col gap-6 print:max-w-none">
        {/* THE INTRO BLOCK, AND ON PAPER THE COVER PAGE, section I forcing a page break after it.
            NOT A NUMBERED SECTION: no heading, no share link and no unseen dot, and NO BOTTOM MARGIN either,
            being a sibling of the four sections whose distance the parent column's `gap-6` already sets.
            See docs/DECISIONS.md#theory-hero-plate-sizes-against-the-chart */}
        {/* A card on screen (matches ChartSection's), the cover page on paper — every card property stripped
            with `print:*`, including `bg-transparent` so a painted background doesn't print as an off-white
            block behind the title. The `print:mt-[18vh]` cover reserve stays on this element. */}
        <div
          className={cn(
            CARD_PLAIN,
            "flex flex-col gap-3 p-3 print:mt-[18vh] print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none",
          )}
        >
          {/* NOT A HEADING ELEMENT, and `aria-hidden`: the page's <h1> is the sticky header's lockup, which
              announces this exact string on both tabs. A second h1 would compete with it, and an h2 would sit
              above section I's own h2 for no structural reason.
              See docs/DECISIONS.md#theory-hero-plate-sizes-against-the-chart */}
          <p
            aria-hidden
            data-print-hero-title
            className="text-balance mx-auto flex w-full flex-col items-center font-extrabold leading-tight tracking-tight text-slate-900 text-center print:mb-[5vh]"
            /* TWO SIZES: the measured one for screen, and `--print-title-size` because paper must not inherit
               it. See docs/DECISIONS.md#theory-hero-plate-sizes-against-the-chart */
            style={{
              "fontSize": getChartTitleSizePx(heroChartWidth || FE_UI.page.chartMinWidthPx),
              "--print-title-size": `${getChartTitleSizePx(FE_UI.page.chartMaxWidthPx)}px`,
            }}
          >
            {/* Two sibling spans, which the plate's `flex-col` sets as two rows; the second is print-only and
                pinned a step under the title. See docs/DECISIONS.md#theory-hero-plate-sizes-against-the-chart */}
            <span>{SITE_COPY.title}</span>
            <span className="hidden text-xl print:block">v{FRAMEWORK_VERSION}</span>
          </p>

          {/* `data-print-hero-radar` is a hook for print CSS only — see the rule in index.css. The radar
              inside is sized imperatively from its SCREEN width, and on paper that measurement is stale in a
              way no JS can correct (`beforeprint` fires BEFORE the print layout exists, so measuring there
              still reads the screen). The rule releases the frame's pinned height instead, so the canvas can
              scale to the printed frame by its own aspect ratio. */}
          <div data-print-hero-radar className="mx-auto w-full" style={{ maxWidth: FE_UI.page.chartMaxWidthPx }}>
            <StaticCompetencyChart
              levels={[]}
              plainLabels={false}
              pointLabelPxRange={HERO_POINT_LABEL_PX_RANGE}
              clusterLabelColors
              heroLabelNudge
              hidePolygon
              showLevelTicks
              fullWidth
              onFrameWidthChange={handleHeroFrameWidth}
              aria-label="Empty 9-pillar competency radar"
            />
          </div>

          {/* Both the second sentence's break and the byline's are MEASURED, not styled, and the two decisions
              are inverted. `print:px-[15vw]` narrows the measure on paper, where `vw` resolves against the page
              box and a 900px line is too long to track.
              See docs/DECISIONS.md#tagline-breaks-are-measured-not-styled */}
          <p className="relative mx-auto w-full text-center text-xs sm:text-sm leading-tight text-slate-700 print:mt-[5vh] print:px-[15vw] print:text-base">
            {/* The measurement PROBE, not the visible text: `invisible` rather than `hidden` because it must
                still lay out to have a height.
                See docs/DECISIONS.md#tagline-breaks-are-measured-not-styled */}
            <span ref={taglineProbeRef} aria-hidden className="invisible pointer-events-none absolute inset-x-0 top-0 block">
              {SITE_COPY.tagline}
            </span>
            <span className={cn(taglineFitsOneLine && "block")}>{SITE_COPY.tagline}</span>{" "}
            <span className={cn(taglineFitsOneLine && "block")}>
              {SITE_COPY.detail}{" "}
              <span className={cn("whitespace-nowrap text-slate-500", taglineFitsOneLine && "block")}>
                {SITE_COPY.byline}
                {" "}
                <MalaysiaFlag withTooltip />
              </span>
            </span>
          </p>
        </div>

        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.pillars]} className="flex flex-col gap-3 print:break-before-page">
          {/* Head sentinel sits ABOVE the heading so it is reached before the dot it clears. */}
          <SectionSentinel section={THEORY_SECTIONS.pillars} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.pillars].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.pillars].intro}
            section={THEORY_SECTIONS.pillars}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.pillars)}
          />
          <PillarGrid showLatestChanges={false} />
          <SectionSentinel section={THEORY_SECTIONS.pillars} edge="tail" gapClass="-mt-3" />
        </section>

        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.seniority]} className="flex flex-col gap-3 print:break-before-page">
          <SectionSentinel section={THEORY_SECTIONS.seniority} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.seniority].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.seniority].intro}
            section={THEORY_SECTIONS.seniority}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.seniority)}
          />
          <SeniorityStepper />
          <SectionSentinel section={THEORY_SECTIONS.seniority} edge="tail" gapClass="-mt-3" />
        </section>

        {/* NO SUBTITLE UNDER THIS HEADING, unlike I and II, and still `gap-3` where section IV drops to `gap-1`.
            See docs/DECISIONS.md#section-iii-pairs-a-paragraph-with-what-it-introduces */}
        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.matrix]} className="flex flex-col gap-3 print:break-before-page">
          <SectionSentinel section={THEORY_SECTIONS.matrix} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.matrix].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.matrix].intro}
            section={THEORY_SECTIONS.matrix}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.matrix)}
          />
          {/* TWO PAIRS, EACH ITS OWN `gap-2` GROUP INSIDE THE SECTION'S `gap-3`, so neither paragraph reads as a
              caption for the block above it. The tier pair is the legend for the second.
              See docs/DECISIONS.md#section-iii-pairs-a-paragraph-with-what-it-introduces */}
          <div className="flex flex-col gap-2">
            <p className={DOC_SECTION.intro}>{SKILL_TIERS_INTRO}</p>
            <SkillTierBands />
          </div>
          <div className="flex flex-col gap-2">
            <p className={DOC_SECTION.intro}>{COMPETENCY_MATRIX_INTRO}</p>
            <CompetencyMatrix
              expandedPillar={expandedPillar}
              onExpandedPillarChange={setExpandedPillar}
              scrollNav={matrixNav}
              showLatestChanges={false}
            />
          </div>
          <SectionSentinel section={THEORY_SECTIONS.matrix} edge="tail" gapClass="-mt-3" />
        </section>

        {/* `gap-3` like the other sections, now that the intro carries the S1-S5 / L1-L5 note: the paragraph
            is what separates this h2 from the h3 below it. It was `gap-1` while the intro was empty, a bare
            title line having to hug the subsection title that otherwise read as detached across 12px. */}
        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="flex flex-col gap-3 print:break-before-page">
          <SectionSentinel section={THEORY_SECTIONS.tracks} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.tracks].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.tracks].intro}
            section={THEORY_SECTIONS.tracks}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.tracks)}
          />
          <CareerTracks isVisible={isVisible} />
          <SectionSentinel section={THEORY_SECTIONS.tracks} edge="tail" gapClass="-mt-3" />
        </section>
      </div>
    </>
  );
}

export { TheoryContent };
