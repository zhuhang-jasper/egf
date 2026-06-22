import { useEffect, useLayoutEffect, useRef } from "react";

import { ChevronDown } from "lucide-react";

import { ShareLinkButton } from "@/components/ShareLinkButton";

import { getClusterSurfaceBg } from "@/constants";
import { COMPETENCY_MATRIX, SENIORITY_LEVEL_DEFINITIONS } from "@/constants/theory-data";
import { DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { getPillarCardElementId, persistExpandedPillar, THEORY_SECTIONS } from "@/utils/theory-url";

const levelBadgeClass = cn("flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white", DOC_TEXT.badgeMicro);

// Expand/collapse animation length — must match the `duration-300` on the panel below, so the
// scroll-into-view waits until layout has settled before measuring.
const MATRIX_ANIM_MS = 300;

function LevelCellContent({ level }) {
  if (!level?.persona) {
    return level?.text ?? "";
  }

  return (
    <>
      <span className="font-semibold text-slate-800">{level.persona}</span> {level.text}
    </>
  );
}

function PillarMatrixLevels({ levels }) {
  return (
    <>
      <div className="divide-y divide-slate-300/50 px-3 py-1 min-[650px]:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex items-start gap-2 py-2">
            <span className={levelBadgeClass}>{code}</span>
            <p className={cn("min-w-0 flex-1", DOC_TEXT.bodyMedium)}>
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-5 gap-2 px-3 py-2 min-[650px]:grid">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex min-w-0 flex-col gap-1.5 border-r border-slate-300/50 px-1 last:border-r-0">
            <span className={levelBadgeClass}>{code}</span>
            <p className={DOC_TEXT.bodyMedium}>
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function PillarMatrixCard({ order, pillarId, pillarName, focusSummary, color, textColor, levels, expanded, onToggle, cardRef }) {
  const panelId = `competency-matrix-${pillarId}`;

  return (
    <article
      ref={cardRef}
      id={getPillarCardElementId(pillarId)}
      className="overflow-hidden rounded-xl border border-white/70 border-l-[3px] shadow-md shadow-slate-200/40"
      style={{ backgroundColor: getClusterSurfaceBg(color), borderLeftColor: textColor }}
    >
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2 px-3 pt-2.5 text-left transition-colors hover:bg-black/[0.04]",
          expanded ? "pb-1.5 border-b border-slate-300/60" : "pb-2.5",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className={cn("min-w-0", DOC_TEXT.cardTitlePlain)}>
            {order}. {pillarName}
          </h3>
          <p className={cn("min-w-0", DOC_TEXT.body)}>{focusSummary}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-slate-800 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>

      {/* CSS grid-rows 0fr→1fr animates the panel height open/closed without measuring pixels. */}
      <section
        id={panelId}
        aria-labelledby={`${panelId}-trigger`}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <PillarMatrixLevels levels={levels} />
          <div className="flex justify-center border-t border-slate-300/60 py-2">
            <ShareLinkButton
              section={THEORY_SECTIONS.matrix}
              pillar={pillarId}
              label="Copy link to this content"
              ariaLabel="Copy link to this content"
            />
          </div>
        </div>
      </section>
    </article>
  );
}

function CompetencyMatrix({ expandedPillar, onExpandedPillarChange, scrollNav }) {
  const cardRefs = useRef({});
  const scrollTimerRef = useRef(null);
  const cancelScrollRef = useRef(null);

  const cancelPendingScroll = () => {
    clearTimeout(scrollTimerRef.current);
    cancelScrollRef.current?.();
    cancelScrollRef.current = null;
  };

  // Scroll the just-opened card's top under the sticky bar, after the expand/collapse animation
  // settles. A previously-open card *above* the new one collapses over MATRIX_ANIM_MS, so the new
  // card keeps sliding up while we scroll — a single measurement lands it under the bar with no gap.
  // scrollBelowStickyHeaderUntilSettled re-aims until the layout stops moving. Driven from the click
  // — NOT a `useLayoutEffect` on `expandedPillar` — so it never fires on mount/refresh (which would
  // yank the restored scroll) or twice under StrictMode.
  const scrollToCardSoon = (pillarId) => {
    cancelPendingScroll();
    scrollTimerRef.current = setTimeout(() => {
      const card = cardRefs.current[pillarId];
      if (card) {
        cancelScrollRef.current = scrollBelowStickyHeaderUntilSettled(card);
      }
    }, MATRIX_ANIM_MS);
  };

  useEffect(() => () => cancelPendingScroll(), []);

  const handleToggle = (pillarId) => {
    const next = pillarId === expandedPillar ? null : pillarId;
    persistExpandedPillar(next);
    onExpandedPillarChange(next);
    if (next) {
      scrollToCardSoon(next);
    } else {
      cancelPendingScroll();
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
    <div className="space-y-3">
      {COMPETENCY_MATRIX.map((pillar) => (
        <PillarMatrixCard
          key={pillar.pillarId}
          {...pillar}
          expanded={expandedPillar === pillar.pillarId}
          onToggle={() => handleToggle(pillar.pillarId)}
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
