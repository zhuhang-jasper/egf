import { useLayoutEffect, useRef } from "react";

import { InstallPill } from "@/components/InstallPrompt";

import { SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, setStickyScrollOffset } from "@/utils/scroll";

/**
 * The whole app header: a 56px bar pinned at the viewport top at every scroll depth, holding the brand lockup
 * and the install pill in its two corners.
 *
 * Sticky, not in flow. In flow its height was part of every scroll coordinate on the page, so expanding it
 * silently changed what a remembered offset meant. Sticky removes the cause, which is what lets
 * `useTabScrollMemory` store a plain `scrollY`.
 *
 * DON'T PUT THE TITLE BACK HERE. The bar is pinned on both tabs at every scroll depth, so anything in it is paid
 * for on every screen; that is what made a collapsible title necessary before, and then made the collapse state
 * contested. The title and tagline now open the Theory tab.
 *
 * `bg-slate-100` must be OPAQUE (content scrolls underneath) and must be `100` rather than `50`, which is only a
 * ~3% step off white and does not read as a tint at all. This value has six dependents that must move with it:
 * AppBottomNav's bar, its active segment, its inactive hover, the unseen-dot ring, `body` in index.css, and
 * HomePage's wrapper. The last two want it IDENTICAL, not merely legible against it.
 *
 * `p-3` is one 12px inset declared once here (it is also what the corner controls' `top-3` resolves against).
 * `min-h-14` is the header's entire height, since both children are absolutely positioned and contribute none:
 * 56px is `12 + 32 + 12`. `print:hidden` because otherwise only this box's padding reaches paper, as a blank band
 * above the cover. No corner radius: it would only be visible at `scrollY 0`, so the bar would change shape there.
 */
function AppShellHeaderStack() {
  const stackRef = useRef(null);

  // Publish how much pinned chrome a scroll target has to clear, so deep links and pillar jumps land below the
  // header rather than underneath it. Measured on the sticky element itself, and still observed even though the
  // height is constant: that keeps it a fact about the rendered box rather than an assumption.
  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return undefined;
    }

    const syncStickyOffset = () => {
      setStickyScrollOffset(stack.getBoundingClientRect().height);
    };

    syncStickyOffset();
    const observer = new ResizeObserver(syncStickyOffset);
    observer.observe(stack);

    return () => {
      observer.disconnect();
      clearStickyScrollOffset();
    };
  }, []);

  return (
    <div
      ref={stackRef}
      id="app-shell-header-stack"
      // The tint, the border and the shadow do three different jobs at one edge: chrome-not-page, a crisp rest
      // edge (a tint boundary alone reads as a smudge), and floating above what scrolls under. All three belong
      // on this box, since its bottom edge IS the boundary; on a child the shadow drew a line across the header.
      //
      // No `relative` needed for the corner controls: `sticky` already establishes a containing block.
      className="sticky top-0 z-40 min-h-14 border-b border-slate-200 bg-slate-100 p-3 shadow-sm print:hidden"
    >
      <AppShellBrandMark />
      {/* Renders nothing unless this browser can install the app, so the corner is simply empty where there is
          no install path. Absent rather than inert. */}
      <InstallPill />
    </div>
  );
}

/**
 * The stacked words of the brand lockup (see AppShellBrandMark).
 *
 * Centred on the numeral by the parent's `items-center`, and the comparison is INK, not line boxes: a two-line
 * block inks `ascender + lineHeight` (~25.9px here) against the digit's ~27.4px, while its boxes total 30.8px.
 * Matching the boxes is what once left the stack visibly short. If the type sizes change, re-judge by eye.
 *
 * `items-start` so both lines set flush left against the numeral. `flex-col` is here but `flex` is not, since
 * the caller supplies it.
 */
const WORDS_CLASS = "flex-col items-start text-[14px] font-black leading-[1.1] tracking-tight";

/**
 * The framework's identity mark, pinned to the header stack's top-left, and THE PAGE'S <h1>.
 *
 * It carries the document title because nothing else can: the Theory panel is `hidden` while the tool tab is
 * active, so an h1 living only there would leave the tool tab with no heading in the accessibility tree. The
 * lockup itself stays `aria-hidden` behind an `sr-only` title, since a screen reader should hear the name rather
 * than a numeral followed by two half-lines.
 *
 * An oversized numeral with the name stacked beside it, not a plain label: the numeral does the identifying, so
 * the words can go small without the mark becoming unrecognisable. Two lines rather than the full-size mark's
 * three, because three inside a 32px row lands at ~8.5px type; the reflow lives in `SITE_COPY.shortLockup`.
 *
 * The two type sizes are COUPLED and compared by ink, not line boxes (see WORDS_CLASS). One size at every width,
 * and no breakpoints at all: this row used to carry hand-measured thresholds derived from the old segmented
 * control's width, and every term went stale whenever anything moved. The full lockup now fits from ~253px,
 * below the app's 350px floor, so there is nothing to switch on. If something is added back to this row, give it
 * its own line rather than reintroducing a measured threshold. See docs/DECISIONS.md#brand-lockup-has-no-breakpoints.
 *
 * `BASE_URL`, not a bare "/", because the Pages build serves from /egf/.
 */
function AppShellBrandMark() {
  const { numeral, lines } = SITE_COPY.shortLockup;

  return (
    // `pointer-events-none`: the h1 is a landmark, not a control, so swallowing pointer events over the header's
    // left corner would be its only possible effect.
    <h1 className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 items-center gap-2 print:hidden">
      <span className="sr-only">{SITE_COPY.title}</span>
      {/* `size-8` matches the control opposite, which brackets the bar. Intrinsic size stays 96px for retina;
          `rounded-lg` matches that control's radius rather than the mark's own 4px. */}
      <img src={`${import.meta.env.BASE_URL}favicon-96x96.png`} alt="" aria-hidden width={96} height={96} className="size-8 shrink-0 rounded-lg" />
      <span aria-hidden className="flex h-8 items-center gap-1 text-slate-900">
        {/* The type size is not the glyph height: lining figures stand to the cap height (~0.72em), so 38px
            inks ~27px and fills about 86% of the 32px logo. `leading-[0.72]` pulls the line box back down to the
            glyph so it does not blow out the row and drag the logo off the shared centre line. */}
        <span className="text-[38px] font-black leading-[0.72] tracking-tighter">{numeral}</span>
        <span className={cn(WORDS_CLASS, "flex")}>
          {lines.map((line) => (
            <span key={line} className="whitespace-nowrap">
              {line}
            </span>
          ))}
        </span>
      </span>
    </h1>
  );
}

export { AppShellHeaderStack };
