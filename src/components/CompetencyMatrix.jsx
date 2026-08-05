import { useEffect, useLayoutEffect, useRef } from "react";

import { ChevronDown } from "lucide-react";

import { EmphasizedText } from "@/components/EmphasizedText";
import { ShareLinkButton } from "@/components/ShareLinkButton";

import { getClusterSurfaceBg, getClusterSurfaceHoverBg } from "@/constants";
import { COMPETENCY_MATRIX, SENIORITY_LEVEL_DEFINITIONS, SKILL_TIERS } from "@/constants/theory-data";
import { DOC_TEXT, WHATS_NEW_HIGHLIGHT_CLASS } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { glideElementBelowStickyHeader, holdElementInPlace, scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { getPillarCardElementId, persistExpandedPillar, THEORY_SECTIONS } from "@/utils/theory-url";

const levelBadgeClass = cn("flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white sm:size-6", DOC_TEXT.badgeMicro);

/** "( (L1) Learner )" — white pill with the dark level circle on the left and the level title beside it. */
function LevelPill({ code, term }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-slate-300/60 bg-white py-0.5 pl-0.5 pr-2.5">
      <span className={levelBadgeClass}>{code}</span>
      <span className="truncate text-[11px] font-semibold leading-snug text-slate-500 sm:text-[12px] md:text-[13px]">{term}</span>
    </span>
  );
}

// Expand/collapse animation length — must match the `duration-300` on the panel below, so the
// scroll-into-view waits until layout has settled before measuring.
const MATRIX_ANIM_MS = 300;

function LevelCellContent({ level, showLatestChanges }) {
  if (!level?.persona) {
    return <EmphasizedText text={level?.text} boldClassName={WHATS_NEW_HIGHLIGHT_CLASS} plain={!showLatestChanges} />;
  }

  return (
    <>
      <span className="mb-1.5 block font-bold text-slate-900">{level.persona}</span>{" "}
      <EmphasizedText text={level.text} boldClassName={WHATS_NEW_HIGHLIGHT_CLASS} plain={!showLatestChanges} />
    </>
  );
}

function PillarMatrixLevels({ levels, showLatestChanges }) {
  return (
    <>
      {/* NO VERTICAL PADDING HERE — each row brings its own `py-2`, so the first and last already sit 8px
          off the strips above and below, matching the `py-2` on the desktop branch whose rows have none.
          The `py-1` this used to carry stacked on top of that and made mobile 12px for no reason. */}
      <div className="divide-y divide-slate-300/50 px-3 sm:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, term }) => (
          <div key={code} className="flex flex-col py-2 gap-2">
            <LevelPill code={code} term={term} />
            <p className={DOC_TEXT.bodyMedium}>
              <LevelCellContent level={levels[code]} showLatestChanges={showLatestChanges} />
            </p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-5 gap-2 px-3 py-2 sm:grid">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, term }) => (
          <div key={code} className="flex min-w-0 flex-col gap-2 border-r border-slate-300/50 px-1 last:border-r-0">
            <LevelPill code={code} term={term} />
            <p className={DOC_TEXT.bodyMedium}>
              <LevelCellContent level={levels[code]} showLatestChanges={showLatestChanges} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The pillar's focus areas as three cumulative skill tiers (framework v4.0). Rendered in the always
 * visible card header, so the tiers read without expanding the pillar.
 *
 * Each tier is labelled with a colored pill carrying the same tint as its band in the Skill Tiers card
 * at the head of this section, so the key and the nine cards that use it read as one system — which is
 * why that card sits directly above these rather than in the section before. The list is a two-column
 * grid
 * whose first track is `max-content`: the pill column sizes itself to the longest label, so the three
 * pills share one width and the focus-area text starts on a common edge, with no hardcoded width to
 * outgrow (a wider label at a smaller breakpoint just widens the track).
 */
function FocusTierList({ focusTiers }) {
  const tiers = SKILL_TIERS.filter(({ id }) => focusTiers?.[id]);
  if (!tiers.length) {
    return null;
  }

  return (
    <ul className="grid min-w-0 grid-cols-[max-content_1fr] gap-x-2 gap-y-1.5">
      {tiers.map(({ id, label, bandClass }) => (
        // Each row spans both tracks via subgrid, so every pill lands in the shared first column.
        <li key={id} className={cn("col-span-2 grid min-w-0 grid-cols-subgrid", DOC_TEXT.body)}>
          {/* `font-semibold` last so it beats `badgeMicro`'s `font-bold` (twMerge keeps the later of
              two conflicting utilities). */}
          <span className={cn("self-start rounded-full px-2 py-0.5 text-center", DOC_TEXT.badgeMicro, bandClass, "font-semibold")}>{label}</span>
          <span className="min-w-0">{focusTiers[id]}</span>
        </li>
      ))}
    </ul>
  );
}

function PillarMatrixCard({
  order,
  pillarId,
  pillarName,
  focusTiers,
  note,
  color,
  textColor,
  levels,
  expanded,
  onToggle,
  cardRef,
  showLatestChanges,
  printBreakBefore = true,
}) {
  const panelId = `competency-matrix-${pillarId}`;

  return (
    <article
      ref={cardRef}
      id={getPillarCardElementId(pillarId)}
      /* `print:break-before-page` gives every pillar its own sheet EXCEPT the first, which shares page one
         with the section's opening matter rather than leaving it stranded (see `printBreakBefore` at the
         call site).
         Deliberately NOT paired with `break-inside-avoid`: a pillar card is about a page tall and some
         run over, and telling an over-tall box not to break is what makes it overlap the next one.
         `print:overflow-visible` — A CLIPPED BOX CANNOT BE SPLIT ACROSS A PAGE. `overflow: hidden` makes
         a box monolithic in paged media, so at a page break the browser has to move the whole thing to
         the next sheet — leaving the space it had already been allocated behind as a blank gap — or, when
         the box is taller than a sheet, let it run over whatever follows. With nine pillars expanded
         these cards are far taller than a page, so they MUST be allowed to fragment.
         The clip is only ever a screen concern: it keeps child backgrounds inside the rounded corners and
         the coloured left edge. Nothing here actually overflows, so dropping it on paper costs nothing.
         Every card in the theory and tool tabs has the same clip and the same need — see PillarCluster
         and CareerTracks. */
      /* ONE CARD, ONE HOVER. The header and the strip below the focus areas are two buttons doing the
         same thing, so a tint that followed the cursor between them made the card look like two
         controls stacked — hover the title, the title lights; slide down to the strip, the title goes
         dark and the strip lights. The tint therefore lives HERE, on their shared parent, keyed off
         `[data-matrix-toggle]:hover`, so either trigger lights the whole card and moving between them
         changes nothing.
         The attribute selector is doing real work: a plain `has-[button:hover]` would also fire for the
         copy-link button inside the expanded panel, which is a *different* action and must not read as
         "this toggles". Only the two toggles carry the marker.

         BOTH SURFACE COLOURS COME IN AS CUSTOM PROPERTIES, and the utilities only ever switch between
         them. They are per-cluster and computed, so they cannot live in a class — but an inline
         `background-color` would beat any `hover:bg-*` utility, so the value that varies is the *variable*
         and `background-color` itself stays in CSS where the hover variant can win. */
      className={cn(
        "overflow-hidden rounded-xl border border-white/70 border-l-[3px] shadow-md shadow-slate-200/40 print:overflow-visible",
        "group/card bg-(--card-surface) transition-colors has-[[data-matrix-toggle]:hover]:bg-(--card-surface-hover)",
        printBreakBefore && "print:break-before-page",
      )}
      style={{
        "--card-surface": getClusterSurfaceBg(color),
        "--card-surface-hover": getClusterSurfaceHoverBg(color),
        "borderLeftColor": textColor,
      }}
    >
      {/* THE HEADER IS A SECOND, SILENT TRIGGER. The visible control is the strip at the foot of the card; this
          keeps the card-wide tap target that a labelled strip cannot match on a phone, but it carries NO
          affordance of its own any more. It used to end in a caret, then a labelled caret, then a bordered
          rail — each of which had to be paid for out of the same row the wrapping focus-area list needs, and
          none of which said plainly that a matrix was inside. Handing that job to a full-width strip returned
          the whole row to the content.

          It also matters MORE now that the strip has moved below the panel: on a collapsed card the two
          triggers are adjacent, but on an expanded one the header is the only way to close the pillar without
          scrolling to the end of its matrix.

          `aria-controls`/`aria-expanded` on both triggers is deliberate: they are two controls for one panel,
          which assistive tech states correctly, rather than one control with a hidden second hit area. */}
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        data-matrix-toggle
        // `print:border-b` — ON PAPER THIS HEADER CARRIES THE DIVIDER ITSELF. Every pillar prints open and both
        // footer rows are `print:hidden`, so nothing else separates the summary from the levels; without it the
        // pillar name would run straight into its own level grid. On screen the divider is the copy-link row's
        // top border, at the far end of the matrix.
        className="flex w-full cursor-pointer select-none flex-col gap-2 px-3 pt-2.5 pb-2.5 text-left print:border-b print:border-slate-300/60 print:pb-1.5"
      >
        <h3 className={cn("min-w-0", DOC_TEXT.cardTitlePlain, "font-bold")}>
          {order}. {pillarName}
        </h3>
        <FocusTierList focusTiers={focusTiers} />
        {note ? <p className={cn("min-w-0", DOC_TEXT.bodyItalic, "opacity-90")}>{note}</p> : null}
      </button>

      {/* CSS grid-rows 0fr→1fr animates the panel height open/closed without measuring pixels.

          `print:grid-rows-[1fr]` FORCES EVERY PILLAR OPEN ON PAPER, regardless of what is expanded on
          screen: a printed matrix is a reference document, and one where 8 of 9 pillars are missing
          because of how someone happened to leave the page is not one.
          It also removes a clipping bug rather than working around it. A collapsed panel is still fully
          laid out — squeezed to a 0fr track with its content clipped by the `overflow-hidden` below — and
          paged media does not honour that clip: printing fragments the page, a fragmented
          `overflow: hidden` box spills, and every collapsed pillar painted its whole L1–L5 grid over the
          cards after it. Fully open, there is no clip in play at all, so nothing can escape it.
          (The same trick the header intro uses to print open — see AppShellHeader.) */}
      <section
        id={panelId}
        aria-labelledby={`${panelId}-trigger`}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none print:grid-rows-[1fr]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* This clip is what squeezes the panel shut while the track above is 0fr. On paper the track is
            always 1fr (see above), so there is nothing left to clip — and keeping it would make the
            panel unsplittable across a page break. See the article's `print:overflow-visible`. */}
        <div className="overflow-hidden print:overflow-visible">
          <PillarMatrixLevels levels={levels} showLatestChanges={showLatestChanges} />
          {/* `print:hidden` on the STRIP, not just the button inside it (which carries its own): this
              row exists only to hold that button, so hiding the button alone would leave an empty
              bordered band under every pillar — and on paper there are now nine of them.

              INSIDE the panel, unlike the toggle below it, which is deliberate: this row is about the
              matrix, so it should scroll in and out with the levels rather than sit under a collapsed
              card offering to copy a link to content that is not on screen. Its `border-t` is what
              separates the levels from the card's footer rows. */}
          <div className="flex justify-center border-t border-slate-300/60 py-2 print:hidden">
            <ShareLinkButton
              section={THEORY_SECTIONS.matrix}
              pillar={pillarId}
              label="Copy link to this content"
              ariaLabel="Copy link to this content"
            />
          </div>
        </div>
      </section>

      {/* THE DISCLOSURE, AS A FULL-WIDTH STRIP RATHER THAN A CORNER CARET, AND ALWAYS THE CARD'S LAST ROW.
          It reads the same either side of the toggle, which is the point:

            collapsed   the last thing in the card, so it reads as "continue here"
            expanded    still the last thing, so "Hide matrix" is where the matrix ENDS

          It used to sit ABOVE the panel so it would hold still while the levels opened under it. That
          traded a stationary control for an unreachable one: an expanded L1–L5 grid is several screens
          tall, so a reader who had scrolled to the bottom of it had no way to close the pillar except to
          scroll all the way back up past everything they had just read. Below the panel the control is
          wherever the reading ends. Collapsed, it has not moved at all — a 0fr panel occupies no space,
          so this is still the row directly under the focus areas.

          A SIBLING OF THE PANEL, NOT INSIDE IT: it must stay operable when the panel is squeezed to 0fr,
          and anything inside is clipped away with the levels.

          FULL WIDTH BUYS THE WORDS BACK. "View matrix" cost ~86px of the header row and was cut to "L1-L5"
          and then to a stacked pair to fit; here the width is free, so the control can say what it opens.
          "matrix" is the word the section's lead-in uses (see COMPETENCY_MATRIX_INTRO), so the copy and the
          control name the same thing — which was the actual complaint: nine collapsed cards look like the
          Section I pillar grid, so a paragraph about a 45-cell matrix seemed to describe another page.

          `border-t` MATCHES THE COPY-LINK ROW now directly above it, so the card's foot is one idiom used
          twice: copy-link, then close. No `border-b` in either state any more — the card's own bottom edge
          closes the strip, and while expanded the divider job belongs to the copy-link row's top border.

          `print:hidden` — a control that cannot be operated on paper, where every pillar is already open, so
          the caret would point the wrong way and the label would advertise a done deal. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        data-matrix-toggle
        className={cn(
          "flex w-full cursor-pointer select-none items-center justify-center gap-1.5 border-t border-slate-300/60 py-2",
          // The tint is the card's (see the article). The label darkening stays local to the strip but is
          // driven from the CARD's hover state, so hovering the header up top also sharpens the words down
          // here — the strip is where this control says what it does, and both triggers are that control.
          "text-slate-600 transition-colors group-has-[[data-matrix-toggle]:hover]/card:text-slate-900 print:hidden",
          DOC_TEXT.badgeSm,
        )}
      >
        {expanded ? "Hide matrix" : "View matrix"}
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
    </article>
  );
}

function CompetencyMatrix({ expandedPillar, onExpandedPillarChange, scrollNav, showLatestChanges = false }) {
  const cardRefs = useRef({});
  const cancelScrollRef = useRef(null);

  // Both toggle paths now start their scroll on the commit that begins the animation, so there is no
  // pending `setTimeout` to clear here any more — only a running rAF loop to stop.
  const cancelPendingScroll = () => {
    cancelScrollRef.current?.();
    cancelScrollRef.current = null;
  };

  // EXPANDING GLIDES ON THE ANIMATION'S OWN CLOCK, starting with it rather than after it.
  //
  // This used to wait MATRIX_ANIM_MS and then smooth-scroll, which forced the two halves of one gesture to
  // happen in sequence: the new levels animated open wherever the reader happened to be standing — a flash
  // of content far down the page — and only then did the view travel up to meet them. Running the glide on
  // the same 300ms budget as the panels makes it a single movement: the card rises into place as its levels
  // open, and there is no interval during which the matrix is visible but misplaced.
  //
  // The glide must not begin until the panel's `grid-rows` change is COMMITTED, or the first frame measures
  // the old layout (collapsing card still at full height) and aims at a destination that never existed. So
  // the click records its intent here and a `useLayoutEffect` below starts the glide post-commit.
  //
  // A ref, rather than a `useLayoutEffect` keyed on `expandedPillar` alone: only a click may scroll. Keying
  // on the value would also fire on mount and on refresh — yanking the scroll position the theory tab had
  // just restored — and twice under StrictMode. Consuming the ref makes the effect inert unless a toggle
  // actually set it.
  const pendingExpandRef = useRef(null);

  // COLLAPSING PINS THE CARD INSTEAD OF CHASING IT, and starts NOW rather than after the animation.
  //
  // The close control sits at the FOOT of the matrix, so it is normally clicked from the far end of
  // several screens of levels — all of which are ABOVE the viewport and all of which vanish. Waiting
  // MATRIX_ANIM_MS and then gliding produced two separate movements for one click: first the page
  // lurched upward on its own (the browser clamping `scrollY` to a document that just lost several
  // screens of height), then our smooth scroll travelled back to the card. The lurch was never a scroll
  // we asked for, so there was no way to make it graceful — only to stop it happening.
  //
  // Holding the card still for the duration of the collapse absorbs the clamp frame by frame: the card does
  // not move at all, the levels concertina shut into it, and there is nothing left to recover from afterwards.
  //
  // WHERE it holds is the card's own current position, not the top of the page (see holdElementInPlace, which
  // floors it at the sticky inset). That distinction covers the other two ways this gets clicked without a
  // special case for either: from the HEADER, the card's top is already at the inset, so every correction is
  // zero and the pin is invisible; scrolled UP with the card mid-viewport, the card is already in view, so the
  // right amount of scrolling is none and the pin holds it exactly where the reader left it.
  const holdCardWhileCollapsing = (pillarId) => {
    cancelPendingScroll();
    const card = cardRefs.current[pillarId];
    if (card) {
      cancelScrollRef.current = holdElementInPlace(card, { durationMs: MATRIX_ANIM_MS });
    }
  };

  // Starts the expand glide once the panel's new `grid-rows` value is committed, so frame one measures the
  // layout the animation is actually running toward. Runs on every commit but does nothing unless a click
  // left a pillar id in the ref — see `pendingExpandRef`.
  useLayoutEffect(() => {
    const pillarId = pendingExpandRef.current;
    if (!pillarId) {
      return;
    }
    pendingExpandRef.current = null;
    cancelPendingScroll();
    const card = cardRefs.current[pillarId];
    if (card) {
      cancelScrollRef.current = glideElementBelowStickyHeader(card, { durationMs: MATRIX_ANIM_MS });
    }
  });

  useEffect(() => () => cancelPendingScroll(), []);

  const handleToggle = (pillarId) => {
    const collapsing = pillarId === expandedPillar;
    const next = collapsing ? null : pillarId;
    persistExpandedPillar(next);
    onExpandedPillarChange(next);
    if (collapsing) {
      holdCardWhileCollapsing(pillarId);
    } else {
      // Hand off to the layout effect above, which starts the glide once this state change has committed
      // and the card can be measured against the layout it is animating toward.
      pendingExpandRef.current = pillarId;
    }
  };

  // Cross-tab jump from a tool-form pillar's help icon. Keyed on `scrollNav.seq` (bumps every click)
  // so it always scrolls the card to the top — even when the pillar was already expanded. (Expansion
  // for this path is driven by TheoryContent's matrixNav handler, not openPillar.)
  //
  // Gate on `expandedPillar === pillarId`: TheoryContent expands the target via a state update in a
  // post-paint `useEffect`, which commits a render *after* this sibling effect would first fire on
  // the seq bump. If we scrolled on that first commit (card still collapsed, height 0), the measured
  // top would be wrong and the scroll would be lost — the bug seen when no pillar was expanded yet.
  // Waiting until the expansion has committed makes the measurement reliable in both cases.
  const scrollNavSeq = scrollNav?.seq;
  useLayoutEffect(() => {
    const pillarId = scrollNav?.pillarId;
    if (!pillarId || expandedPillar !== pillarId) {
      return undefined;
    }

    const card = cardRefs.current[pillarId];
    if (!card) {
      return undefined;
    }

    // Double rAF: the theory tabpanel was just un-hidden (display:none → block) in this same commit,
    // so its layout box isn't ready yet. First frame lets it lay out, second lets getBoundingClientRect
    // settle. Then wait MATRIX_ANIM_MS so the expand animation finishes shifting layout before we
    // measure the card's top.
    //
    // Scroll smoothly: by now the theory tab has restored its remembered scroll (bar kept stuck), so
    // the glide starts from a sensible spot rather than the previous tab's position. Flip
    // cancelRestoreRef *first* so the restore loop stops re-asserting — otherwise its per-frame
    // scrollWindowTo would fight the smooth scroll and snap it back, the interruption seen before.
    let timer = null;
    let inner = null;
    let cancelSettled = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          if (scrollNav?.cancelRestoreRef) {
            scrollNav.cancelRestoreRef.current = true;
          }
          // Re-aim until settled: if a different pillar was open and is collapsing above this one,
          // the target slides up during the collapse, so a single scroll would land it gapless.
          cancelSettled = scrollBelowStickyHeaderUntilSettled(card);
        }, MATRIX_ANIM_MS);
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) {
        cancelAnimationFrame(inner);
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
      cancelSettled?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollNavSeq, expandedPillar]);

  return (
    <div className="flex flex-col gap-3">
      {COMPETENCY_MATRIX.map((pillar, index) => (
        <PillarMatrixCard
          key={pillar.pillarId}
          {...pillar}
          // One printed sheet per pillar, EXCEPT the first: breaking before it too would strand the
          // section's opening matter on a page of its own. Pillar 1 shares page one with it instead.
          printBreakBefore={index > 0}
          expanded={expandedPillar === pillar.pillarId}
          onToggle={() => handleToggle(pillar.pillarId)}
          showLatestChanges={showLatestChanges}
          cardRef={(node) => {
            if (node) {
              cardRefs.current[pillar.pillarId] = node;
            } else {
              delete cardRefs.current[pillar.pillarId];
            }
          }}
        />
      ))}
    </div>
  );
}

export { CompetencyMatrix };
