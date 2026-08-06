import { useEffect, useState } from "react";

import { ChevronsUp } from "lucide-react";

import { getWindowScrollY, scrollWindowToTop } from "@/utils/scroll";

/**
 * Scroll to the top of the page, as a floating button above the bottom nav.
 *
 * IT USED TO BE IN THE HEADER'S RIGHT CORNER (see AppShellHeader) and moved out when the install pill took that
 * corner. The header was a poor fit for it in hindsight: the button is gated on `scrollY > 0`, so it left the
 * corner empty for the whole first screenful, and a pinned bar's slots are the most expensive real estate in the
 * app — they are paid for on every screen of both tabs. A control that is only relevant while scrolled belongs
 * where it can appear and disappear without leaving a hole in the chrome.
 *
 * THEORY TAB ONLY, which is a deliberate narrowing rather than an oversight. The theory document is thousands of
 * pixels of reading with four numbered sections and eight radar charts; getting back to the top of it is a real
 * journey. The tool tab is a chart and a form that fit in roughly two screenfuls, and its own content is the
 * thing you are manipulating — a floating button over the form's right edge would cover input rows to save a
 * gesture nobody needed. Callers gate this by not rendering it (see HomePage).
 *
 * IT ONLY EXISTS WHILE THERE IS SOMEWHERE TO GO. Gated on `scrollY > 0`, unchanged from the header version. A
 * control that is always present but does nothing for the whole first screenful is worse than no control: it
 * teaches that pressing it has no effect, which is the lesson that then applies when it would have worked.
 *
 * `bottom-[calc(4.25rem+…)]` IS THE SAME OFFSET THE INSTALL BANNER USES, for the same reason and against the same
 * bar — see InstallPrompt's note. It clears AppBottomNav's 3.5rem plus a gap plus the safe-area inset, so this
 * never lands on top of the app's primary navigation.
 *
 * THE BANNER AND THIS CAN BE ON SCREEN TOGETHER, and they do not collide: the banner is a centred `inset-x-0`
 * row and this is pinned to the right edge at the same height, so on a narrow phone the banner would sit under
 * this button's corner. `z-30` puts this BELOW the banner's `z-[100]`, so during the (rare, and dismissible)
 * overlap the banner wins and this tucks behind it rather than punching through the card.
 *
 * `smooth`, unlike the instant scrolls elsewhere in the app: those are restores and jumps that should feel like
 * the page was always there, whereas this is a journey the user asked for and the motion is the feedback that it
 * happened. `motion-reduce` is honoured by the browser's own `scroll-behavior` handling of `smooth`.
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
      // ROUND AND OPAQUE-WHITE WITH A SHADOW, unlike the square `slate-200` tile this was in the header. The
      // treatment there existed to read as a control against the header's `slate-100` TINT; out here it floats
      // over white page content instead, where a slate fill would read as a smudge and the shadow is what says
      // "above the page" — the same job the header's own `shadow-sm` does for the bar.
      //
      // NO TOOLTIP, which the header version had. A tooltip is a hover affordance and this is a thumb target on
      // the tab where touch dominates; the `aria-label` still names it for assistive tech. The double chevron is
      // also a strong enough convention on a floating button that a label would be explaining the obvious.
      className="fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-lg transition-colors hover:bg-slate-100 hover:text-slate-900 print:hidden"
    >
      <ChevronsUp className="size-5" aria-hidden />
    </button>
  );
}
