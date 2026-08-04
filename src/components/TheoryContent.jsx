import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Image, Printer, ScrollText, Share2 } from "lucide-react";

import { CareerTracks } from "@/components/CareerTracks";
import { ChangelogModal } from "@/components/ChangelogModal";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";
import { Button } from "@/components/ui/button";
import { UnseenDot } from "@/components/UnseenDot";

import { getSectionSentinelId, useSectionSeenObserver } from "@/hooks/useSectionSeenObserver";

import { FE_UI, FRAMEWORK_VERSION, IS_ADMIN, SITE_COPY } from "@/constants";
import {
  COMPETENCY_MATRIX,
  COMPETENCY_MATRIX_INTRO,
  getSkillTierBands,
  SENIORITY_LEVEL_DEFINITIONS,
  SKILL_TIERS_INTRO,
  THEORY_SECTION_COPY,
} from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { hrefForRoute } from "@/utils/route";
import { scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { getPersistedExpandedPillar, getPillarCardElementId, persistExpandedPillar, THEORY_SECTION_IDS, THEORY_SECTIONS } from "@/utils/theory-url";

const cardClass = "rounded-xl border border-slate-300 bg-white shadow-md shadow-slate-200/40";

// Admin-only shortcuts to the standalone Poster/Social pages. These navigate away (full page load),
// not in-app tabs. They live in this tab's toolbar rather than the app header so the header layout is
// identical for admin and non-admin users. Gated by IS_ADMIN (?admin=1).
const ADMIN_LINKS = [
  { route: "poster", label: "Poster", icon: Image },
  { route: "social", label: "Social", icon: Share2 },
];

/**
 * The look of the 32px square controls at the left of this tab's toolbar, worn by both the print button and
 * the admin page links so the row reads as one group rather than two treatments that happen to match.
 *
 * EVERY ONE OF THEM IS A `<Button>`, including the links — the admin entries render through `asChild`, which
 * passes these classes onto a real `<a>` rather than wrapping one. That distinction is worth keeping: they
 * navigate to another page, so they must stay anchors to keep cmd/middle-click, the right-click menu, the URL
 * on hover, and a screen reader announcing "link" instead of "button". Routing them through `onClick` would
 * look identical and quietly take all of that away.
 *
 * Only the surface lives here (radius, border, fill, text and hover colors). The layout, transition and
 * focus-visible ring come from `buttonVariants` at `size="icon"`, which is already this 32px square.
 */
const TOOLBAR_ICON_SURFACE = "shrink-0 rounded-lg border-slate-200 bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900";

// Stable fallback for the unseen-sections prop, so a caller that omits it doesn't hand the observer
// a fresh Set identity on every render.
const NO_UNSEEN_SECTIONS = new Set();
const noop = () => {};
const returnsFalse = () => false;

// Skill-tier band geometry is static — resolve the chained start/width percentages once.
const SKILL_TIER_BANDS = getSkillTierBands();

// THE MATRIX OPENS ITS FIRST PILLAR ON A FRESH VISIT, so the section shows what a pillar card actually
// contains instead of asking the reader to take the lead-in's word for it. Nine collapsed cards read as a
// second copy of the Section I pillar grid — a name over its focus areas — with the 45 cells nowhere on
// screen. The first item open is what an accordion normally does for exactly this reason.
//
// Read from the matrix data rather than hardcoding "coding", so it follows the authored pillar order.
const DEFAULT_EXPANDED_PILLAR = COMPETENCY_MATRIX[0].pillarId;

/**
 * The expanded pillar to boot with, resolving the three persisted states (see
 * `getPersistedExpandedPillar`) against that default.
 *
 * A STORED EMPTY STRING WINS OVER THE DEFAULT: the user closed the matrix and reloaded, and reopening it
 * for them would be the app arguing. Only a session that has never touched the matrix gets the default.
 *
 * A PILLAR DEEP-LINK SUPPRESSES IT TOO. The staged effect below deliberately boots from the persisted
 * pillar and switches to the link's target only once scroll-restore has settled; opening pillar 1 here
 * would just mean opening it to collapse it again ~350ms later, shifting layout mid-restore for nothing.
 */
function getInitialExpandedPillar(deepLink) {
  const persisted = getPersistedExpandedPillar();
  if (persisted !== null) {
    return persisted || null;
  }

  const deepLinkPillar = deepLink?.section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
  return deepLinkPillar ? null : DEFAULT_EXPANDED_PILLAR;
}

// Hero radar pillar-label sizing: scales linearly with the chart, 12px at its small-mobile width up
// to 15px at FE_UI.page.chartMaxWidthPx (the wrapper cap below). Shared with the tool chart so the
// two stay identical — see FE_UI.chart.pointLabelPxRange. Its stable module-level identity also
// satisfies StaticCompetencyChart, which memoizes on this object.
const HERO_POINT_LABEL_PX_RANGE = FE_UI.chart.pointLabelPxRange;

// On a deep-link boot, how long to let the scroll-restore loop settle at the remembered position
// before we switch the expanded pillar. Long enough to clear restore's initial frames; short enough
// that the transition still feels prompt.
const DEEPLINK_RESTORE_SETTLE_MS = 350;
// Expand/collapse animation length — matches the `duration-300` on the matrix panel. After switching
// to the deep-link pillar we wait this out so the card has stopped moving before we measure & glide.
const DEEPLINK_EXPAND_ANIM_MS = 300;

/**
 * Whether the tagline's first sentence fits on a single line at the current width.
 *
 * Drives where the second sentence goes, per the rule: if the first sentence fits on one line the second
 * starts a new one; if the first has to wrap, the second continues inline instead. Forcing a break in the
 * wrapped case is what produced an orphaned word on its own line with the next sentence stranded below it.
 *
 * NOT EXPRESSIBLE IN CSS, which is why this measures. The condition depends on whether the RENDERED text
 * fits, a fact only available after layout — a media query would instead have to hardcode "the width at
 * which ~104 characters of `text-sm` fit", which is a number that goes stale silently the moment the copy
 * or the type scale changes. `scrollHeight` against a single line's height is the direct question.
 *
 * This lived in AppShellHeader while the tagline was part of the app header, and moved here with it.
 */
function useFitsOneLine(ref) {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    // Compare the rendered height against one line's worth. Line height comes from the computed style
    // rather than a constant so it tracks the responsive `text-xs sm:text-sm` step without being told.
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        return;
      }
      // 1.5 lines as the threshold: comfortably above rounding noise on a single line, comfortably below two.
      setFits(el.scrollHeight < lineHeight * 1.5);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return fits;
}

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
 * SELF-CONTAINED AXIS. An L1-L5 ruler sits directly above the bands and is the only thing naming the
 * horizontal scale, at every width. This card used to live at the tail of the Proficiency Levels
 * section, where from `sm:` up it also registered with the five level cards above it — the ruler
 * pulled out to the card's outer edge and the band edges were computed through the card grid's
 * gutters, so "Core ends mid-L3" landed over the actual L3 column. Moved to the head of the matrix
 * section (it is the legend for the tier pills on every pillar card), there is no column grid above it
 * to register with, so both the ruler and the bands are plain percentages of this card's own track:
 * five equal 20% cells, band edges at their authored percentages. The ruler and the bands share that
 * one track, so they stay exact against each other, which is the alignment that carries the meaning.
 *
 * A FIGURE, NOT A TITLED CARD. The "Skill Tiers" h3 and the explanatory caption that used to bracket
 * these bands both live outside now — the prose as `SKILL_TIERS_INTRO` immediately above (see the call
 * site), the heading nowhere, since a title inside the box would repeat what that paragraph just said.
 * What is left is the drawing.
 *
 * IT KEEPS ITS BORDER, though. Dropping the card was considered and rejected: three small tinted bands and
 * a ruler on bare white read as unfinished, and the nine pillar cards below are cluster-tinted with a
 * coloured left edge, so a plain white card is already a visibly different kind of object rather than a
 * tenth one competing with them.
 */
function SkillTierBands() {
  return (
    <div className={cn(cardClass, "p-3")}>
      {/* Ruler: five equal 20% cells naming the axis the bands below are measured against. Both are plain
          percentages of this one track — see the docblock for what was dropped when this card stopped
          sitting under the five level cards. */}
      <div className="grid grid-cols-5 border-b border-slate-200 pb-1">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <span key={code} className={cn("text-center", DOC_TEXT.badgeMicro, "text-slate-400")}>
            {code}
          </span>
        ))}
      </div>

      {/* Bands are normal flow rows, indented with a margin rather than absolutely positioned, so the
          track's height comes from its content and the row gap is just the flex `gap`. A margin (not a
          grid column) is what lets an edge land mid-column. */}
      <div className="mt-1.5 flex flex-col gap-1 sm:gap-2">
        {SKILL_TIER_BANDS.map(({ id, label, startPct, widthPct, bandClass }) => (
          <div
            key={id}
            // `bodySemibold` for the 12/13/14 body ramp (these labels are content, not a heading);
            // `bandClass` stays last so the tier's text color beats that token's `text-slate-800`.
            className={cn(
              // `px-2` at sm and up, not `px-3`: the widest label ("Foundational") sits in the NARROWEST
              // band, so horizontal padding is charged against the tightest budget on the track.
              "flex items-center justify-center rounded-md px-1.5 py-1 italic sm:rounded-lg sm:px-2 sm:py-1.5",
              DOC_TEXT.bodySemibold,
              bandClass,
            )}
            // Straight percentages of the track: no clamping needed, since 0-100% now IS the box.
            //
            // `minWidth: max-content` guards the label: the browser measures the rendered text and refuses
            // to draw the band narrower. Where it binds it wins over exact positioning, since an
            // approximate percentage is fine (see `SKILL_TIERS`) but a clipped word is a bug.
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
    </div>
  );
}

// The two branches are mutually exclusive breakpoint views of the same five levels, so a fragment is
// enough — there is nothing left to space now that the Skill Tiers card has moved to the matrix
// section (it was the only sibling this needed a flex column for).
function SeniorityStepper() {
  return (
    <>
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
  const taglineFitsOneLine = useFitsOneLine(taglineProbeRef);

  // Clears a section's dot once both its head and tail have been in view AND the section has settled
  // on screen. Observes only the still-unseen sections, so this is inert for a caught-up user.
  useSectionSeenObserver(isVisible, unseenSections, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen);

  // Expanded pillar state lives here so the matrix share button can read it. On a deep-link boot we
  // intentionally start from the *persisted* pillar, NOT the deep-link's — so the page first restores
  // its previous scroll against the layout it was saved with (old pillar A still open). The deep-link
  // effect below then switches to pillar B (collapse A, expand B) once restore has settled, and only
  // then glides to B. Expanding B immediately here would shift layout under the restore and land it
  // at the wrong spot.
  const [expandedPillar, setExpandedPillar] = useState(() => getInitialExpandedPillar(deepLink));

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
    <>
      {/* Toolbar row: admin page links left, changelog right. The admin shortcuts used to float at the
          right edge of the sticky tab bar, which forced an admin-only mobile layout up there; moving them
          here keeps the app header identical for every user. `justify-between` with an empty left side
          still parks the changelog button on the right for non-admins.

          OUTSIDE THE SECTIONS COLUMN, and a sibling of it rather than its first child. That column's `gap-6`
          is the spacing BETWEEN SECTIONS; this row is page chrome, not a section, and being in there meant
          inheriting a 24px gap and then cancelling most of it back with `-mb-2` — a negative margin whose
          only job was to undo the container it had been put in.

          `mb-4` is the real number: 16px above the framework title, matching the tool tab's toolbar row
          against its own first element (see ChartSection). Keep the two in step, or the page appears to
          shift when you switch tabs. */}
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-1.5">
          {/* PRINT, FOR EVERYONE — the admin links beside it are gated behind `?admin=1`, this is not. The
              theory tab is built to print as a reference document: a cover sheet, then a page per pillar. Until
              now the only route to it was the browser's own menu, which readers do not associate with a page
              they are looking at. Same 32px square as the admin links so the group reads as one row.

              `window.print()` and nothing else. Paper size, margins and destination all live in the browser's
              dialog and none of them can be set from script — deliberately, since they are the user's choice.
              What the app CAN do is make its own layout insensitive to them, which is what `@page` and the
              print rules in index.css are for. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => window.print()}
            title="Print the framework"
            aria-label="Print the framework"
            className={TOOLBAR_ICON_SURFACE}
          >
            <Printer className="size-4" aria-hidden />
          </Button>
          {IS_ADMIN
            ? ADMIN_LINKS.map(({ route, label, icon: Icon }) => (
                // `asChild` — styled as a button, still an anchor. See TOOLBAR_ICON_SURFACE for why these
                // navigate as links rather than through an onClick handler.
                <Button key={route} asChild variant="outline" size="icon" className={TOOLBAR_ICON_SURFACE}>
                  <a href={hrefForRoute(route)} title={label} aria-label={label}>
                    <Icon className="size-4" aria-hidden />
                  </a>
                </Button>
              ))
            : null}
        </div>
        <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => setChangelogOpen(true)} className="gap-1">
          <ScrollText className="size-3.5 shrink-0" aria-hidden />
          Show Changelog
        </Button>
      </div>

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {/* THE SECTIONS COLUMN. `gap-6` here means one thing only: the distance between the cover and the four
          numbered sections, and between those sections. Nothing that is not one of those five belongs in it. */}
      <div className="flex flex-col gap-6 print:max-w-none">
        {/* THE INTRO BLOCK, AND ON PAPER THE COVER PAGE — section I forces a page break, so the first
            sheet carries exactly this: the framework title, the empty radar, and the tagline.

            NOT A NUMBERED SECTION. It has no content of its own, so it gets no heading, no share link
            and no unseen dot — it is the title plate that the four sections follow. That is also why
            the app header carries no title block any more: this is where the framework introduces
            itself, one tap from the tool rather than permanently above it.

            ONE ORDER FOR BOTH MEDIA: title, radar, tagline. This block briefly ran radar-first on screen
            with `print:order-first` lifting the title on paper, a divergence inherited from the days when
            the title lived in the app header and the tagline had to be rendered a SECOND time under the
            radar (the old `AppShellPrintTagline`) because no CSS could interleave two components with a
            tab panel between them. With all three as siblings here, the ordering utility is gone too:
            what you see is what prints.

            `print:mt-[18vh]` — A RESERVE, NOT A MEASUREMENT: it pushes the trio down the sheet so it
            reads as a cover rather than sitting at the top with the rest blank. The block's height is
            content-driven (the radar is sized at runtime, the tagline wraps to its own measure), so
            there is nothing to centre against from here. Landing a little above true centre is the
            safe direction — overflow the sheet by a pixel and the cover becomes two pages.

            NO BOTTOM MARGIN: this is a sibling of the four sections now, so the parent column's `gap-6`
            sets the distance to section I, the same distance that separates every other pair. It used to
            carry `mb-4` because it lived in a nested `gap-2` column with section I inside it. */}
        <div className="flex flex-col print:mt-[18vh] gap-3">
          {/* NOT A HEADING ELEMENT, and `aria-hidden`: the page's <h1> is the lockup in the sticky header
              (see AppShellBrandMark), which announces this exact string and is present on both tabs. A
              second h1 here would compete with it, and an h2 would sit above section I's own h2 for no
              structural reason.

              `mb-2` on screen, `print:mb-[5vh]` on paper. The printed cover has a whole sheet for three
              elements, so the title and the plate below it read as a title and a figure rather than a
              heading jammed against a chart; that generous space is paired with the tagline's matching
              `print:mt-[5vh]` on the other side, so the radar sits in equal air.

              The version is print-only. On screen it is already in the bottom nav's Theory tab. */}
          <p
            aria-hidden
            className="text-balance mx-auto flex w-full flex-col items-center text-center text-xl sm:text-2xl font-extrabold leading-tight tracking-tight text-slate-900 print:mb-[5vh]"
          >
            {/* THE VERSION IS PRINT-ONLY. On screen the bottom nav's Theory tab already carries a `v4.1`
                badge, so stating it again under the title said the same number twice within a thumb's reach.
                A printout has no nav, and a reference document should say which version of the framework it
                is — so paper gets it and the screen does not.

                Two sibling spans, which the plate's `flex-col` sets as two rows: that is the layout paper
                wants, and on screen the second one is simply not rendered. `text-xl` holds it a step under the
                title's larger print size rather than inheriting it. */}
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
              aria-label="Empty 9-pillar competency radar"
            />
          </div>

          {/* THE SECOND SENTENCE BREAKS ONLY IF THE FIRST FITS ON ONE LINE (see `useFitsOneLine`). When the
              first sentence already has to wrap, forcing a break too leaves an orphaned word with the next
              sentence stranded below it; letting it run on instead fills the lines. So:

                first fits    → `block`, `detail` starts its own line
                first wraps   → `inline`, `detail` continues the flow

              NOT `text-pretty` on the paragraph. That algorithm shortens earlier lines to avoid a short
              final one, and against the byline's unbreakable `whitespace-nowrap` run it produced ragged
              lines with dead space at both ends — the text read as padded even though nothing here has
              horizontal padding. The byline keeps its `nowrap` (a name should not split); it just must not
              meet an algorithm that reacts to it.

              THE BYLINE FOLLOWS THE SAME MEASUREMENT, INVERTED. It is nested inside `detail`'s span, so it
              is subject to that span's decision first, and then takes one of its own:

                tagline fits  → `mt-1 block`, attribution on its own line, 4px under `detail`
                tagline wraps → inline, trailing `detail` wherever that sentence happens to end

              Which sounds backwards until you look at the two results. Compact, the plate has three short
              centred lines and room to give the credit its own; already wrapped, the text is three or four
              full-measure lines and a fourth holding two words would read as a stray fragment, so trailing
              is tidier. `whitespace-nowrap` in both cases — a name should not split — and that unbreakable
              run is also why `text-pretty` cannot be used on the paragraph to tidy any of this up.

              `mt-1` is paired with `block` rather than set unconditionally because it is only meaningful in
              that branch: a vertical margin on an inline span pushes nothing apart, so leaving it on in the
              wrapped case would be a rule that silently does nothing.

              `print:px-[15vw]` narrows the measure on paper: `vw` resolves against the page box in print,
              and a 900px line is far too long to track on a printed sheet. */}
          <p className="relative mx-auto w-full text-center text-xs sm:text-sm leading-tight text-slate-700 print:mt-[5vh] print:px-[15vw] print:text-base">
            {/* The measurement PROBE, not the visible text. It is always `block`, so its height answers
                "would this sentence fit on one line here?" independently of what the visible copy is
                currently doing — measuring the real span would be circular, since switching it between
                `block` and `inline` changes the very height the decision is read from, and the two states
                could oscillate.

                `invisible` rather than `hidden`: it must still be laid out to have a height. Absolutely
                positioned and `aria-hidden` so it costs no space and is not announced twice. */}
            <span ref={taglineProbeRef} aria-hidden className="invisible pointer-events-none absolute inset-x-0 top-0 block">
              {SITE_COPY.tagline}
            </span>
            <span className={cn(taglineFitsOneLine && "block")}>{SITE_COPY.tagline}</span>{" "}
            <span className={cn(taglineFitsOneLine && "block")}>
              {SITE_COPY.detail} <span className={cn("whitespace-nowrap text-slate-500", taglineFitsOneLine && "block")}>{SITE_COPY.byline}</span>
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

        {/* NO SUBTITLE UNDER THIS HEADING, unlike I and II. This section is two blocks, each opening with
            its own paragraph (see below), so a third paragraph in the subtitle slot would be introducing an
            introduction. What used to sit there was the matrix lead-in, which described cards two blocks
            further down and read as a caption for the tier diagram in between.

            Still `gap-3` with a bare heading, where section IV drops to `gap-1`: there the next element is an
            h3 subsection title that looked detached from the h2 across 12px, whereas here it is a paragraph
            that opens a group of its own. Pulling that to 4px would make it look like the subtitle this
            section deliberately does not have, and would break it away from the diagram it belongs to. */}
        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.matrix]} className="flex flex-col gap-3 print:break-before-page">
          <SectionSentinel section={THEORY_SECTIONS.matrix} edge="head" gapClass="-mb-3" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.matrix].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.matrix].intro}
            section={THEORY_SECTIONS.matrix}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.matrix)}
          />
          {/* TWO PAIRS, EACH ITS OWN `gap-2` GROUP INSIDE THE SECTION'S `gap-3`: a paragraph bound to the
              thing it introduces, twice. The asymmetry is what does the work — 8px below a paragraph ties it
              to what follows, 12px between the groups keeps them apart — so neither paragraph can be read as
              a caption for the block above it. That was the actual bug here: the tier prose sat BELOW the
              bands, arriving after the reader had already worked out three tiers and five levels from the
              picture, and the matrix lead-in sat under the section heading, two cards above the cards it
              described.

              THE TIER PAIR IS THE LEGEND FOR THE SECOND. Every pillar card labels its focus areas with the
              same three pills in the same tints as these bands, so the key has to come first. It used to
              trail the five level cards in section II, where on a phone it landed as a sixth card in a stack
              of five about something else, and where that section's intro never mentioned tiers at all.

              On paper both pairs share the section's opening sheet with pillar 1, which is a denser page than
              it was before the tier block moved in: heading, two paragraphs, the diagram, then Coding, whose
              level grid runs over onto the next sheet. Pillars 2-9 each get their own sheet. Giving Coding a
              page break of its own instead was tried and is worse — it leaves this sheet two-thirds empty to
              save a card from splitting, and the split is only visible on one pillar out of nine. */}
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

        {/* gap-1 (not the other sections' gap-3): this section's intro is empty, so the heading is a bare
            title line and needs to hug what follows rather than sit above a full gap. Section III's intro is
            empty too but keeps `gap-3` — the difference is what comes next. Here it is an h3 subsection title,
            which reads as detached from the h2 across 12px; there it is a bordered card. */}
        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="flex flex-col gap-1 print:break-before-page">
          <SectionSentinel section={THEORY_SECTIONS.tracks} edge="head" gapClass="-mb-1" />
          <SectionHeading
            title={THEORY_SECTION_COPY[THEORY_SECTIONS.tracks].heading}
            subtitle={THEORY_SECTION_COPY[THEORY_SECTIONS.tracks].intro}
            section={THEORY_SECTIONS.tracks}
            hasUnseenUpdates={unseenSections.has(THEORY_SECTIONS.tracks)}
          />
          <CareerTracks isVisible={isVisible} />
          <SectionSentinel section={THEORY_SECTIONS.tracks} edge="tail" gapClass="-mt-1" />
        </section>
      </div>
    </>
  );
}

export { TheoryContent };
