import { useEffect, useRef, useState } from "react";

import { ScrollText } from "lucide-react";

import { CareerTracks } from "@/components/CareerTracks";
import { ChangelogModal } from "@/components/ChangelogModal";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";
import { Button } from "@/components/ui/button";
import { UnseenDot } from "@/components/UnseenDot";

import { getSectionSentinelId, useSectionSeenObserver } from "@/hooks/useSectionSeenObserver";

import { FRAMEWORK_VERSION } from "@/constants";
import {
  CAREER_TRACKS_SECTION_INTRO,
  getSkillTierBands,
  PILLARS_SECTION_INTRO,
  SENIORITY_LEVEL_DEFINITIONS,
  SENIORITY_SECTION_INTRO,
  SKILL_TIERS_CAPTION,
} from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { getPersistedExpandedPillar, getPillarCardElementId, persistExpandedPillar, THEORY_SECTION_IDS, THEORY_SECTIONS } from "@/utils/theory-url";

const cardClass = "rounded-xl border border-slate-300 bg-white shadow-md shadow-slate-200/40";

// Stable fallback for the unseen-sections prop, so a caller that omits it doesn't hand the observer
// a fresh Set identity on every render.
const NO_UNSEEN_SECTIONS = new Set();
const noop = () => {};
const returnsFalse = () => false;

// Skill-tier band geometry is static — resolve the chained start/width percentages once.
const SKILL_TIER_BANDS = getSkillTierBands();

// Hero radar pillar-label sizing: scale linearly with the chart, from 12px at its small-mobile width
// up to 14px at its desktop max width (the wrapper's max-w-[520px]). Module-level constant so its
// identity is stable across renders (StaticCompetencyChart memoizes on this object).
const HERO_POINT_LABEL_PX_RANGE = { minPx: 12, maxPx: 15, minWidthPx: 300, maxWidthPx: 520 };

// On a deep-link boot, how long to let the scroll-restore loop settle at the remembered position
// before we switch the expanded pillar. Long enough to clear restore's initial frames; short enough
// that the transition still feels prompt.
const DEEPLINK_RESTORE_SETTLE_MS = 350;
// Expand/collapse animation length — matches the `duration-300` on the matrix panel. After switching
// to the deep-link pillar we wait this out so the card has stopped moving before we measure & glide.
const DEEPLINK_EXPAND_ANIM_MS = 300;

/**
 * Zero-height marker bracketing a section's content, used by `useSectionSeenObserver` to detect that
 * the head/tail of the section has been in view.
 *
 * MUST stay IN FLOW. An earlier version used `absolute` to dodge the flex gap (below) and that broke
 * the whole mechanism: `top: auto` on an abs-positioned child means "its static position", but a flex
 * container never gives an abs-positioned child a static position, so BOTH sentinels collapsed onto the
 * section's top-left origin. Head and tail sat at the same point, the pair armed the instant a
 * section's top appeared, and dots cleared long before the user reached the bottom.
 *
 * In flow, the sentinel lands where it is written — which is the whole point, since its document
 * position IS the signal. The cost is that a flex `gap` is charged for every child including a
 * zero-height one, so each sentinel would add its parent's gap (12px at `gap-3`, 4px at `gap-1`) of
 * dead space. `-mt-[gap]` on the tail and `-mb-[gap]` on the head cancel exactly that, keeping section
 * spacing byte-identical to before these existed. The gap value is passed in per section because the
 * four parents don't all use `gap-3`.
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
 * Renders a "Quality / Identity" phase title. When `breakAfterSlash` is set, a line break is
 * forced after the slash — used in the cramped 5-column grid. In the mobile stacked view the
 * levels sit in vertical cards with ample horizontal room, so the break is left off there.
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
 * The three cumulative skill tiers, drawn as staggered bands across the L1-L5 axis. Each band starts
 * at the MIDPOINT of the one before it, so the overlap is visible as horizontal offset: the tiers
 * build on each other rather than partitioning the scale. That overlap is the whole point of the
 * diagram — it is what stops L3 reading as "done with Core" — so the stagger is kept at every width
 * rather than degrading to a stacked list on mobile, which would flatten the idea into three
 * unrelated rows.
 *
 * ONE layout at all sizes. The narrowest band (Foundational, 35% of the track) is the binding
 * constraint: it carries the LONGEST label, so it is the only band whose text can outgrow its box.
 * `minWidth: max-content` on each band is what guarantees the fit — widen the band in `SKILL_TIERS`
 * rather than shrinking the type if a label ever looks cramped, since the percentages are
 * approximate by intent (see `SKILL_TIERS`) but a clipped word is just a bug.
 *
 * An L1-L5 ruler sits above the bands to anchor what the horizontal axis means. On mobile that ruler
 * is the only thing naming the axis, since the level cards are stacked by then and no longer form
 * visual columns above it; on desktop the ruler is aligned to those columns (see below) so the two
 * read as one scale, and the bands are positioned on that same axis via `axisPos`.
 */

/**
 * Where a percentage of the logical L1-L5 axis falls, as a CSS length measured from the LEFT EDGE OF
 * THE BAND TRACK (i.e. inside this card's padding).
 *
 * The axis is defined by the seniority cards above: a real `grid-cols-5 gap-2`, so a column is
 * `(100% - 4g)/5` and NOT 20% of the width. A percentage `p` sits `p/20` columns along — that many
 * column-widths plus the gutters crossed getting there. Gutters are `min(cols, 4)`, never `cols`:
 * five columns have only four gutters, and counting a fifth pushes the 100% mark a full gap past the
 * right edge.
 *
 * The band track is inset by this card's `p-3` + 1px border, while the cards' container is not, so
 * the card-relative position is shifted left by that inset to land in track coordinates. Widths must
 * therefore be a DIFFERENCE of two `axisPos` values — the inset and the gutter terms only cancel for
 * a span measured from 0.
 *
 * `--egf-axis-gap` collapses to 0 on mobile, where the cards are stacked, there are no columns to
 * register with, and the whole expression degrades cleanly to a plain percentage of the track.
 */
const AXIS_GAP = "var(--egf-axis-gap)";
const AXIS_INSET = "var(--egf-axis-inset)";

function axisPos(pct) {
  const cols = pct / 20;
  const gutters = Math.min(cols, 4);
  return `calc(${cols} * (100% + 2 * ${AXIS_INSET} - 4 * ${AXIS_GAP}) / 5 + ${gutters} * ${AXIS_GAP} - ${AXIS_INSET})`;
}

function SkillTierBands() {
  return (
    // `--egf-axis-gap` mirrors the card grid's `gap-2`, `--egf-axis-inset` this card's `p-3` + 1px
    // border. Both are 0 on mobile, where the cards are stacked: with no columns to register with,
    // `axisPos` degrades to a plain percentage of the track, which is the right behavior there.
    <div
      className={cn(
        cardClass,
        "flex flex-col gap-2 p-3",
        "[--egf-axis-gap:0px] [--egf-axis-inset:0px]",
        "sm:[--egf-axis-gap:0.5rem] sm:[--egf-axis-inset:calc(0.75rem+1px)]",
      )}
    >
      <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>Skill Tiers</h3>

      <div>
        {/* Ruler: five equal cells naming the axis the bands are measured against.

            From `sm:` up it also has to REGISTER with the seniority cards above, which are a
            `grid-cols-5 gap-2` sibling in the same column — so each code sits centred over its own
            card. Two things have to match for that:

              1. the 8px gutter (`sm:gap-2`) — otherwise the cells are 20% of a gapless track and
                 each one drifts left of its card, worsening toward L5;
              2. the outer width. This card adds `p-3` (12px) and a 1px border that the card grid's
                 container does not have, so the ruler is inset ~13px per side and its cells come out
                 narrower than the columns. That error is symmetric about the centre: L3 looks right
                 while L1/L2 sit left and L4/L5 sit right of their cards.

            `-mx-[13px]` fixes (2) by pulling the track back out to the card's outer edge. Do NOT add
            matching `px` here to keep the end labels inboard — it restores the exact width just
            removed and silently makes this a no-op. The labels are centred in their cells and the
            cells now match the columns, so the end codes land over their cards, not off the card.

            Mobile stacks the cards, so there is nothing to register against and both are dropped.

            The bands below register with the same axis via `axisPos`. */}
        <div className="grid grid-cols-5 border-b border-slate-200 pb-1 sm:-mx-[calc(0.75rem+1px)] sm:gap-2">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
            <span key={code} className={cn("text-center", DOC_TEXT.badgeMicro, "text-slate-400")}>
              {code}
            </span>
          ))}
        </div>

        {/* Bands are normal flow rows, indented with a computed margin rather than absolutely
            positioned, so the track's height comes from its content and the row gap is just
            `space-y`. A computed offset (not a grid column) is what lets an edge land mid-column. */}
        <div className="mt-1.5 flex flex-col gap-1 sm:gap-2">
          {SKILL_TIER_BANDS.map(({ id, label, startPct, endPct, bandClass }) => (
            <div
              key={id}
              // `bodySemibold` for the 12/13/14 body ramp (these labels are content, not a heading);
              // `bandClass` stays last so the tier's text color beats that token's `text-slate-800`.
              className={cn(
                // `px-2` at sm and up, not `px-3`: the widest label ("Foundational") sits in the
                // NARROWEST band, so horizontal padding is charged against the tightest budget on
                // the track.
                "flex items-center justify-center rounded-md px-1.5 py-1 italic sm:rounded-lg sm:px-2 sm:py-1.5",
                DOC_TEXT.bodySemibold,
                bandClass,
              )}
              // Edges sit on the card axis via `axisPos`, and width is the DIFFERENCE of two axis
              // positions — the card-padding inset and the gutter terms only cancel for a span
              // measured from 0, so mapping a width on its own would come out short.
              //
              // The two OUTER edges are clamped into the track and are knowingly inexact: 0% and 100%
              // are the card grid's outer edges, which lie under this card's padding, so drawing them
              // truly would overhang the card. `max(0px, …)` and the `min(…, 100%)` implied by
              // clamping the right edge give up those two positions to keep the band inside its box.
              // The four INTERIOR edges — Foundational's end, Core's start and end, Advanced's start
              // — are the ones that carry meaning against the level cards, and they stay exact.
              //
              // `minWidth: max-content` still guards the label: the browser measures the rendered
              // text and refuses to draw the band narrower. It only binds in narrow layouts (chiefly
              // mobile, where there are no columns to register with anyway); where it does bind it
              // wins over exact positioning, since an approximate percentage is fine but a clipped
              // word is a bug.
              style={{
                marginLeft: `max(0px, ${axisPos(startPct)})`,
                width: `calc(min(100%, ${axisPos(endPct)}) - max(0px, ${axisPos(startPct)}))`,
                minWidth: "max-content",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <p className={DOC_TEXT.body}>{SKILL_TIERS_CAPTION}</p>
    </div>
  );
}

function SeniorityStepper() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description }) => (
          <div key={code} className={cn(cardClass, "flex items-center gap-2 p-3")}>
            <span className={cn(levelBadgeClass, "size-7", DOC_TEXT.badgeMd)}>{code}</span>
            <div className="flex min-w-0 flex-col gap-2">
              <SeniorityPhaseTitle
                phase={phase}
                className={cn("min-w-0", DOC_TEXT.bodySemibold, "font-bold text-[13px] sm:text-[14px] md:text-[15px]")}
              />
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        {/* Three shared rows (badge / title / description) declared on the track, with each card a
            `grid-rows-subgrid` spanning all three, so every row is sized by the tallest card and the
            three parts line up horizontally across all five columns. `breakAfterSlash` splits each
            title at the slash, making the title band a uniform two lines rather than letting each
            column wrap wherever it happens to run out of width. `items-start` top-aligns each part
            within its row band. */}
        <div className="grid grid-cols-5 grid-rows-[repeat(3,auto)] gap-2">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description }) => (
            <div key={code} className={cn(cardClass, "row-span-3 grid min-w-0 grid-rows-subgrid items-start gap-y-2 p-3")}>
              <div className="flex justify-start">
                <span className={cn(levelBadgeClass, "size-7 shrink-0", DOC_TEXT.badgeMd)}>{code}</span>
              </div>
              <SeniorityPhaseTitle
                phase={phase}
                breakAfterSlash
                className={cn("min-w-0", DOC_TEXT.bodySemibold, "font-bold text-[13px] sm:text-[14px] md:text-[15px]")}
              />
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          ))}
        </div>
      </div>

      <SkillTierBands />
    </div>
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

  // Clears a section's dot once both its head and tail have been in view AND the section has settled
  // on screen. Observes only the still-unseen sections, so this is inert for a caught-up user.
  useSectionSeenObserver(isVisible, unseenSections, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen);

  // Expanded pillar state lives here so the matrix share button can read it. On a deep-link boot we
  // intentionally start from the *persisted* pillar, NOT the deep-link's — so the page first restores
  // its previous scroll against the layout it was saved with (old pillar A still open). The deep-link
  // effect below then switches to pillar B (collapse A, expand B) once restore has settled, and only
  // then glides to B. Expanding B immediately here would shift layout under the restore and land it
  // at the wrong spot.
  const [expandedPillar, setExpandedPillar] = useState(getPersistedExpandedPillar);

  // The "What's New" highlighter is permanently OFF: the `**…**` markers still exist in the copy
  // (kept for future use) but the amber fill never renders, so elevated text always reads as plain
  // text. The page-level toggle has been replaced by the "Show changelog" button below; sections
  // receive a hardcoded `false`.
  const [changelogOpen, setChangelogOpen] = useState(false);

  // In-app jump from a tool-form pillar's help icon. Expanding the pillar makes CompetencyMatrix
  // scroll to it; persist so the choice survives like a normal expand. Keyed on `seq` so clicking
  // the same pillar again re-runs (a no-op state change wouldn't re-trigger the matrix scroll).
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

    // For a matrix pillar deep-link, scroll to the (expanded) pillar card itself, not the
    // section heading. Falls back to the section when no pillar is targeted.
    const targetPillar = section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
    const targetId = targetPillar ? getPillarCardElementId(targetPillar) : sectionId;

    // Staged so a shared link feels like a real navigation, not a teleport:
    //   1. double rAF — let the hidden tabpanel lay out so the restore loop can land at the remembered
    //      scroll (against the OLD expanded pillar, the layout that scroll was saved with).
    //   2. after DEEPLINK_RESTORE_SETTLE_MS — restore has settled; NOW switch to the deep-link pillar
    //      (collapse the old one, expand the target). cancelRestoreRef is flipped here because this
    //      expand changes layout and we no longer want restore re-asserting the old position.
    //   3. after the expand animation — re-aim until the card stops moving (the old pillar may be
    //      collapsing above the target, sliding it up), then smooth-glide. A single scroll would land
    //      a below-the-old-pillar target gapless under the bar.
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

  return (
    <div className="flex flex-col gap-6 print:max-w-none">
      <div className="flex flex-col gap-2">
        <div className="flex justify-end print:hidden">
          <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => setChangelogOpen(true)} className="gap-1">
            <ScrollText className="size-3.5 shrink-0" aria-hidden />
            Show Changelog
          </Button>
        </div>

        <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

        <div className="mx-auto w-full max-w-[520px] mb-4">
          <StaticCompetencyChart
            levels={[]}
            plainLabels={false}
            pointLabelPxRange={HERO_POINT_LABEL_PX_RANGE}
            clusterLabelColors
            heroLabelNudge
            hidePolygon
            showLevelTicks
            fullWidth
            aria-label="Empty 9-pillar competency radar"
          />
        </div>

        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.pillars]} className="flex flex-col gap-3">
          {/* Head sentinel sits ABOVE the heading so it is reached before the dot it clears. */}
          <SectionSentinel section={THEORY_SECTIONS.pillars} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title="I. The 9 Pillars"
            subtitle={PILLARS_SECTION_INTRO}
            section={THEORY_SECTIONS.pillars}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.pillars)}
          />
          <PillarGrid showLatestChanges={false} />
          <SectionSentinel section={THEORY_SECTIONS.pillars} edge="tail" gapClass="-mt-3" />
        </section>
      </div>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.seniority]} className="flex flex-col gap-3">
        <SectionSentinel section={THEORY_SECTIONS.seniority} edge="head" gapClass="-mb-3" />
        <SectionHeading
          title="II. The 5 Proficiency Levels (L1–L5)"
          subtitle={SENIORITY_SECTION_INTRO}
          section={THEORY_SECTIONS.seniority}
          hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.seniority)}
        />
        <SeniorityStepper />
        <SectionSentinel section={THEORY_SECTIONS.seniority} edge="tail" gapClass="-mt-3" />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.matrix]} className="flex flex-col gap-3">
        <SectionSentinel section={THEORY_SECTIONS.matrix} edge="head" gapClass="-mb-3" />
        <SectionHeading
          title="III. The 45-Point Competency Matrix"
          subtitle="The full behavioral matrix: 9 pillars across 5 levels. For each pillar, the focus areas are grouped into 3 skill tiers. Expand a pillar to reveal the 5 cells, each describing the observable behaviors expected at that level."
          section={THEORY_SECTIONS.matrix}
          hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.matrix)}
        />
        <CompetencyMatrix
          expandedPillar={expandedPillar}
          onExpandedPillarChange={setExpandedPillar}
          scrollNav={matrixNav}
          showLatestChanges={false}
        />
        <SectionSentinel section={THEORY_SECTIONS.matrix} edge="tail" gapClass="-mt-3" />
      </section>

      {/* gap-1 (not the other sections' gap-3): this section's intro is empty, so the heading is a
          bare title line and needs to hug the first track card rather than sit above a full gap. */}
      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="flex flex-col gap-1">
        <SectionSentinel section={THEORY_SECTIONS.tracks} edge="head" gapClass="-mb-1" />
        <SectionHeading
          title="IV. Career Growth Paths"
          subtitle={CAREER_TRACKS_SECTION_INTRO}
          section={THEORY_SECTIONS.tracks}
          hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.tracks)}
        />
        <CareerTracks />
        <SectionSentinel section={THEORY_SECTIONS.tracks} edge="tail" gapClass="-mt-1" />
      </section>
    </div>
  );
}

export { TheoryContent };
