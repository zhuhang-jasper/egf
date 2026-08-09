import { useEffect, useState } from "react";

import { ChevronsUp } from "lucide-react";

import { getWindowScrollY, scrollWindowToTop } from "@/utils/scroll";

/**
 * Scroll to the top of the page, as a floating button above the bottom nav.
 *
 * Theory tab only, gated by the caller not rendering it: that document is a real journey, whereas the tool tab
 * is two screenfuls and a floating button there would cover form rows to save a gesture nobody needed. It also
 * only exists while `scrollY > 0` — a control that does nothing for a whole screenful teaches that pressing it
 * has no effect.
 *
 * `bottom-[calc(4.25rem+…)]` clears AppBottomNav plus a gap plus the safe-area inset, the same offset the
 * install banner uses. `z-30` puts this below the banner's `z-[100]`, so in the rare overlap on a narrow phone
 * this tucks behind rather than punching through the card.
 *
 * `smooth`, unlike the instant scrolls elsewhere: those are restores that should feel like the page was always
 * there, whereas this is a journey the user asked for and the motion is the feedback.
 */
export function ScrollTopFab() {
  // Whether there is anywhere to scroll up to. The listener is `passive` because this never calls
  // `preventDefault` — a non-passive scroll listener would let this block the scroll it is only observing.
  const [canScrollUp, setCanScrollUp] = useState(false);

  useEffect(() => {
    const sync = () => setCanScrollUp(getWindowScrollY() > 0);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Unmounted rather than hidden: there is nothing to animate to or from, and an invisible button floating over
  // the content would still be in the tab order and still swallow pointer events over that corner.
  if (!canScrollUp) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => scrollWindowToTop({ behavior: "smooth" })}
      aria-label="Scroll to top"
      // Round and opaque-white with a shadow because it floats over white page content, where a slate fill
      // would read as a smudge and the shadow is what says "above the page". No tooltip: this is a thumb target
      // on a touch-dominated tab, and the `aria-label` still names it for assistive tech.
      className="fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-lg transition-colors hover:bg-slate-100 hover:text-slate-900 print:hidden"
    >
      <ChevronsUp className="size-5" aria-hidden />
    </button>
  );
}
