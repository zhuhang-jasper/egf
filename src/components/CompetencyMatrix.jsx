import { useEffect, useLayoutEffect, useRef } from "react";

import { MATRIX_ANIM_MS, PillarMatrixCard } from "@/components/PillarMatrixCard";

import { COMPETENCY_MATRIX } from "@/constants/theory-data";
import { track } from "@/utils/analytics";
import { glideElementBelowStickyHeader, holdElementInPlace, scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { persistExpandedPillar } from "@/utils/theory-url";

function CompetencyMatrix({ expandedPillar, onExpandedPillarChange, scrollNav, showLatestChanges = false }) {
  const cardRefs = useRef({});
  const cancelScrollRef = useRef(null);

  // Both toggle paths now start their scroll on the commit that begins the animation, so there is no
  // pending `setTimeout` to clear here any more — only a running rAF loop to stop.
  const cancelPendingScroll = () => {
    cancelScrollRef.current?.();
    cancelScrollRef.current = null;
  };

  // Expanding glides on the animation's own clock, starting with it rather than after it. See
  // docs/DECISIONS.md#matrix-expand-glide.
  //
  // The glide must not begin until the panel's `grid-rows` change is COMMITTED, or the first frame measures
  // the old layout and aims at a destination that never existed. So the click records intent here and a
  // `useLayoutEffect` below starts the glide post-commit.
  //
  // A ref rather than an effect keyed on `expandedPillar`, because only a click may scroll: keying on the
  // value would also fire on mount and refresh (yanking the position the tab just restored) and twice under
  // StrictMode.
  const pendingExpandRef = useRef(null);

  // Collapsing PINS the card instead of chasing it, and starts now rather than after the animation, so the
  // browser's `scrollY` clamp is absorbed frame by frame instead of being recovered from. Where it holds is
  // the card's own position, floored at the sticky inset, which covers all three ways this is clicked
  // without a special case. See docs/DECISIONS.md#matrix-collapse-pin.
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
      // Expand only. A collapse is how you get back to the list rather than an interest signal, so
      // tracking both would double every read and bury the one event that means "opened this pillar".
      track("matrix_pillar_expanded", { pillar: pillarId });
      // Hand off to the layout effect above, which starts the glide once this state change has committed
      // and the card can be measured against the layout it is animating toward.
      pendingExpandRef.current = pillarId;
    }
  };

  // Cross-tab jump from a tool-form pillar's help icon, keyed on `scrollNav.seq` so it re-scrolls even when
  // the pillar was already expanded. The `expandedPillar === pillarId` gate is required: TheoryContent
  // expands the target in a post-paint effect that commits AFTER this one would first fire, so scrolling on
  // that first commit measures a collapsed, zero-height card and the scroll is lost.
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
