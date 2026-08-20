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
 * Whether the OS share sheet can be opened at all, computed once at module load.
 *
 * A plain `navigator.share` check, deliberately NOT the `canShare({ files })` probe gating the chart's Share
 * button: the link is the payload and `shareTheoryLink` already falls back to text, so gating on file support
 * would hide the button from browsers that can still deliver it.
 */
const CAN_SHARE_LINK = typeof navigator !== "undefined" && typeof navigator.share === "function";

// Stable fallback for the unseen-sections prop, so a caller that omits it doesn't hand the observer
// a fresh Set identity on every render.
const NO_UNSEEN_SECTIONS = new Set();
const noop = () => {};
const returnsFalse = () => false;

// Skill-tier band geometry is static — resolve the chained start/width percentages once.
const SKILL_TIER_BANDS = getSkillTierBands();

// The matrix opens its first pillar on a fresh visit, so the section shows what a card contains rather than
// reading as a second copy of the Section I pillar grid with the 45 cells nowhere on screen. Read from the
// matrix data rather than hardcoded, so it follows the authored pillar order.
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

// Hero radar pillar-label sizing, 12-15px linear — shared with the tool chart (FE_UI.chart.pointLabelPxRange)
// and kept at stable module identity since StaticCompetencyChart memoizes on this object.
const HERO_POINT_LABEL_PX_RANGE = FE_UI.chart.pointLabelPxRange;

// On a deep-link boot, how long to let the scroll-restore loop settle at the remembered position
// before we switch the expanded pillar. Long enough to clear restore's initial frames; short enough
// that the transition still feels prompt.
const DEEPLINK_RESTORE_SETTLE_MS = 350;
// Expand/collapse animation length — matches the `duration-300` on the matrix panel. After switching
// to the deep-link pillar we wait this out so the card has stopped moving before we measure & glide.
const DEEPLINK_EXPAND_ANIM_MS = 300;

/**
 * Zero-height marker bracketing a section's content, used by `useSectionSeenObserver` to detect that the
 * head/tail has been in view.
 *
 * MUST stay IN FLOW: its document position IS the signal, and an `absolute` version collapses both sentinels
 * onto the section's origin. The cost is that flex charges `gap` for a zero-height child, which `gapClass`
 * cancels — passed in per section because the parents do not share a gap.
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
 * The three cumulative skill tiers, drawn as staggered bands across the L1-L5 axis. Each band starts at the
 * MIDPOINT of the one before it: the overlap is the whole point of the diagram, so the stagger is kept at
 * every width rather than degrading to a stacked list on mobile.
 *
 * ONE layout at all sizes, bound by the narrowest band since it carries the longest label. If a label looks
 * cramped, widen the band in `SKILL_TIERS` rather than shrinking the type — a clipped word is a bug.
 *
 * SELF-CONTAINED AXIS: ruler and bands are both percentages of this card's own track, so they stay exact
 * against each other. Keep it that way; computing band edges through an outer grid's gutters broke it once.
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
          // own. It was slate-400 — the lightest text on the page — which left the ruler fainter than the
          // caption directly below it in the same card. Keep it in step if that grey ever moves again.
          <span key={code} className={cn("text-center", DOC_TEXT.badgeMicro, "text-slate-600")}>
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
            // Straight percentages of the track, no clamping needed. `minWidth: max-content` guards the
            // label and wins over exact positioning where it binds — a clipped word is a bug.
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

      {/* `metaBody`, the captions rung: 11px and one shade below in-card body, so this reads as annotation
          on the figure rather than as another paragraph of the section's prose. */}
      <p className={cn("mt-2 border-t border-slate-200 pt-2", DOC_TEXT.metaBody)}>{SKILL_TIERS_CAPTION}</p>
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
              <SeniorityPhaseTitle phase={phase} className={cn("min-w-0", DOC_TEXT.cardTitle, "font-bold")} />
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

  // Clears a section's dot once both its head and tail have been in view AND the section has settled
  // on screen. Observes only the still-unseen sections, so this is inert for a caught-up user.
  useSectionSeenObserver(isVisible, unseenSections, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen);

  // Expanded pillar state lives here so the matrix share button can read it.
  // See docs/DECISIONS.md#theory-deeplink-boot-order for why this starts from the PERSISTED pillar.
  const [expandedPillar, setExpandedPillar] = useState(() => getInitialExpandedPillar(deepLink));

  // The "What's New" highlighter is permanently OFF (hardcoded `false` below) — the `**…**` markers stay in
  // the copy for future use, but the page toggle was replaced by the "Show changelog" button.
  const [changelogOpen, setChangelogOpen] = useState(false);

  // The hero radar's measured frame width, republished by `onFrameWidthChange`; sizes the title above it.
  // `useCallback` because an inline arrow would refire the notify effect on every render of this tab.
  const [heroChartWidth, setHeroChartWidth] = useState(0);
  const handleHeroFrameWidth = useCallback((width) => setHeroChartWidth(width), []);

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

  // Chromium positions the `position: fixed` running footer (see print-running-footer in DECISIONS.md)
  // relative to the scroll offset at the moment print starts, not per-page from a clean slate — printing
  // from partway down the document loses the footer on some sheets. `beforeprint` fires however print was
  // triggered (in-app button, Cmd+P, browser menu), so this is the one place that catches all of them.
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

    // For a matrix pillar deep-link, scroll to the (expanded) pillar card itself, not the
    // section heading. Falls back to the section when no pillar is targeted.
    const targetPillar = section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
    const targetId = targetPillar ? getPillarCardElementId(targetPillar) : sectionId;

    // Staged so a shared link reads as navigation rather than a teleport:
    //   1. double rAF — let the hidden tabpanel lay out so restore lands at the remembered scroll.
    //   2. after DEEPLINK_RESTORE_SETTLE_MS — switch to the deep-link pillar. `cancelRestoreRef` flips here
    //      so restore stops re-asserting the old position against this expand.
    //   3. after the expand — re-aim until the card stops moving (the old pillar may still be collapsing
    //      above it), then smooth-glide. A single scroll lands the target gapless under the bar.
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
   * Hand the theory tab's URL, plus the pillar poster image, to the OS share sheet.
   *
   * `buildTheoryShareUrl(null, null)` gives the plain `?tab=theory` link because this is the tab-level
   * control: it shares the document, not the reader's scroll position. NO TOAST on either outcome — the sheet
   * is its own feedback, and a dismissal is a decision rather than an error.
   */
  const handleShareTheory = async () => {
    const result = await shareTheoryLink(buildTheoryShareUrl(null, null));
    if (result.ok) {
      track("theory_shared", { method: result.method });
    }
  };

  return (
    <>
      {/* Toolbar row: page actions (print, and share where the browser can) at the left, changelog at the right.
          This also held admin shortcuts to the Poster/Social pages, which have moved to their own Admin tab (see
          AdminContent) — so `justify-between` now pins one group to each end for every user, admin or not.

          OUTSIDE THE SECTIONS COLUMN, and a sibling of it rather than its first child. That column's `gap-6`
          is the spacing BETWEEN SECTIONS; this row is page chrome, not a section, and being in there meant
          inheriting a 24px gap and then cancelling most of it back with `-mb-2` — a negative margin whose
          only job was to undo the container it had been put in.

          `mb-4` is the real number: 16px above the framework title. The tool tab's toolbar row carries the
          same `mb-4` against its own first element (see ChartSection) — it reached the same 16px through a
          column `gap-2` plus its own `mb-2` until that was collapsed into this one class, so the two tabs now
          state the spacing identically instead of only agreeing on the total. Keep them in step, or the page
          appears to shift when you switch tabs. */}
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        {/* `gap-2` MATCHES THE TOOL TAB'S EXPORT GROUP (see ChartSection's ExportMenu), which is the same row of
            same-sized pills at the same place in the other tab. This was `gap-1.5` against that group's `gap-2` —
            a 2px difference nobody chose, but visible as the buttons shifting when you flip tabs, which is the
            exact drift TOOLBAR_SURFACE exists to prevent for their colours. Keep the two in step, or switching
            tabs appears to nudge the chrome.

            THIS GROUP CAN BE EMPTY, and is for the common case: Print is admin-gated and Share is mobile-only,
            so a desktop reader without the dev unlock renders neither. That is fine and needs no special case —
            an empty flex child is zero-width, the row's `gap-2` collapses against it, and `justify-between`
            still puts Changelog on the right edge. It is kept as a wrapper rather than flattened into the row
            because it is what groups the left-hand actions when they ARE present. */}
        <div className="flex items-center gap-2">
          {/* PRINT, ADMIN ONLY. The theory tab is built to print as a reference document — a cover sheet, then a
              page per pillar — and the print CSS stays in the build for everyone: `window.print()` from the
              browser's own menu still produces that layout, and `@page` and the print rules in index.css are
              what make it insensitive to the paper size, margins and destination that only the browser's dialog
              can set. This button is just the in-page shortcut to it, and it is now gated behind the dev unlock
              (see constants/features.js) rather than shown to every reader.

              THE FEATURE IS NOT GONE, ONLY THE BUTTON. Nothing about the printed output depends on this being
              rendered, so hiding it costs a reader the affordance and not the capability.

              `group relative` + `<Tooltip>` rather than a native `title`: one tooltip mechanism across the app,
              with no browser delay and the app's own styling. See components/ui/Tooltip.jsx.

              LABELLED, in the same pill as the tool tab's Share/Copy (see ChartSection's ExportMenu). These two
              rows sit at the same place on the page and the user flips between them, so a bare icon here beside
              a labelled pill there read as two different kinds of control. The `aria-label` stays longer than
              the visible word: the label says which action, the aria-label says what it acts on, which is what
              a screen reader needs when the surrounding heading isn't being read. */}
          {IS_ADMIN ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              {/* BADGED ON THE PILL'S OWN CORNER, using the `relative` the Tooltip beside it already requires —
                  and `-top-1.5 -right-1.5` rather than the nav's `-right-1.5 -bottom-1` because a pill's corner
                  is a curve, not a right angle: the same offsets that sit on a square glyph's corner would sit
                  in the empty space outside the radius here.

                  TOP-RIGHT, WHICH IS WHERE THE TOOLTIP IS NOT. The tooltip opens BELOW this button (`placement`
                  above — the toolbar sits under a sticky header, so a top tooltip would render into it), so the
                  bottom corners are the ones that would be crossed on hover.

                  UNLIKE THE MENU ROWS, THIS ONE KEEPS ITS `label`. There is no wrapping <label> element whose
                  accessible name would absorb it, and the button's own `aria-label` says what the action does
                  rather than who can reach it, so the badge is again the only carrier of that fact. */}
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
              size="sm"
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
        {/* THE VERSION RIDES THE CHANGELOG BUTTON, because this is the one control that explains it: the number
            says which version you are reading, and the thing it is printed on is what tells you what changed to
            get here. Anywhere else it is a bare stamp the reader cannot act on.

            IT DOES NOT DUPLICATE THE BOTTOM NAV'S BADGE at any distance that matters. The hero plate keeps its
            version print-only for exactly that reason (see its note) — it sits a thumb's reach from the nav's
            `v4.2`, so on screen it would state the number twice in one glance. This row is at the top of a
            scrolling page while the nav is pinned to the bottom of the viewport, so the two are never read
            together, and the nav's badge is a "which tab" label where this is the document's own version.

            `aria-label` CARRIES THE WHOLE STRING, since the visible text is now two runs and a middot: a screen
            reader would otherwise announce "Changelog · v 4.2" as punctuation between fragments.

            THE MIDDOT IS A SIBLING SPAN, not part of either run, so it takes the separator's own muted grey
            rather than inheriting the label's weight — the same treatment the footer gives its dividers.

            `tabular-nums` MATCHES THE FOOTER'S app version (see HomePage). Version strings are figures, and a
            proportional `1` in `v4.1` would set the pill's width jittering against `v4.2` on the next release. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          onClick={() => {
            // Stamped with the version the reader was ON when they opened it, the same param
            // `theory_section_seen` carries: it says whether a release is what drives people to read
            // what changed.
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
        {/* A card on screen (matches ChartSection's), the cover page on paper — every card property stripped
            with `print:*`, including `bg-transparent` so a painted background doesn't print as an off-white
            block behind the title. The `print:mt-[18vh]` cover reserve stays on this element. */}
        <div
          className={cn(
            CARD_PLAIN,
            "flex flex-col gap-3 p-3 print:mt-[18vh] print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none",
          )}
        >
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
            data-print-hero-title
            /* SIZED FROM THE HERO RADAR'S MEASURED WIDTH via the same getChartTitleSizePx the tool tab's
               title uses, so the two match at every viewport. A title above a chart scales against the chart,
               not the document's breakpoint ladder — the theory panel is 900 wide and hits the radar's cap
               long before `md` fires. The 0 fallback keeps the first paint at mobile size. */
            className="text-balance mx-auto flex w-full flex-col items-center font-extrabold leading-tight tracking-tight text-slate-900 text-center print:mb-[5vh]"
            /* TWO SIZES, AND PAPER MUST NOT INHERIT THE SCREEN'S. `fontSize` is measured from the live frame
               and is stale on paper; `--print-title-size` is the same function at the width paper actually
               uses, computed here rather than hardcoded in CSS so it cannot drift from `chartMaxWidthPx`.
               See docs/DECISIONS.md#print-chart-frame-height-is-stale. */
            style={{
              "fontSize": getChartTitleSizePx(heroChartWidth || FE_UI.page.chartMinWidthPx),
              "--print-title-size": `${getChartTitleSizePx(FE_UI.page.chartMaxWidthPx)}px`,
            }}
          >
            {/* THE VERSION IS PRINT-ONLY. On screen the bottom nav's Theory tab already carries a `v4.1`
                badge, so stating it again under the title said the same number twice within a thumb's reach.
                A printout has no nav, and a reference document should say which version of the framework it
                is — so paper gets it and the screen does not.

                Two sibling spans, which the plate's `flex-col` sets as two rows: that is the layout paper
                wants, and on screen the second one is simply not rendered. `text-xl` (20px) holds it a step
                under the title rather than inheriting it — the title prints at ~21.3px, the size the print
                rule pins it to from the printed frame width (see `--print-title-size` on this element). It
                used to inherit whatever the last SCREEN measurement gave, which is what made this pair
                invert on a phone: a floored title (16.8px then, 14px now) over a 20px version line.

                NO DATE HERE. The version dates itself in the running footer instead, which repeats on every
                sheet rather than only the one that happens to carry the cover. */}
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

        {/* `gap-3` like the other sections. This was `gap-1` for as long as the section's intro was empty:
            a bare h2 title line has to hug the h3 subsection title below it, which otherwise reads as
            detached across 12px. (Section III's intro is empty too but keeps `gap-3`, because what follows
            it is a bordered card rather than another heading.) Now that the intro carries the S1-S5 / L1-L5
            note, the heading is a title plus a paragraph — the same shape as sections I and II — and the
            paragraph is what separates the two headings, so the tight gap has nothing left to fix. */}
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
