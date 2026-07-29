import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronDown, ChevronUp, FileText, Radar } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import { UnseenDot } from "@/components/UnseenDot";

import { FE_UI, FRAMEWORK_VERSION, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, getWindowScrollY, setStickyScrollOffset } from "@/utils/scroll";

const TABS = [
  { id: "tool", label: "Tool", icon: Radar },
  // `version` derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot
  // (see useTheoryUpdates) always agree — bumping that one constant updates both.
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
];

/**
 * Caps the title and tagline to the Theory tab's content width.
 *
 * The header spans the full viewport, so unbounded text sets as one very long line on a wide screen — the eye
 * loses its place travelling back to the start, and `text-balance` on the title never engages because balancing
 * only applies once the text actually wraps.
 *
 * Reusing `theoryMaxWidthPx` rather than picking a Tailwind cap means the header lines up with the widest
 * content the app ever shows, so the two stay in step if that number changes. The cap lives on the text and not
 * on the header itself, because the brand mark and caret need the full width to sit in the real corners.
 */
const HEADER_TEXT_WIDTH_STYLE = { maxWidth: FE_UI.page.theoryMaxWidthPx };

// Two modes, because the caret now does exactly one thing: toggle the header, wherever you are.
//
// There used to be a third, "back to top", which took over whenever the page was scrolled — a workaround
// for the fact that revealing the header at depth shoved all visible content down by its height. That is
// handled in `useHeaderCollapse` now (the scroll position is compensated so nothing moves), and the
// workaround had become the only thing stopping the header from being reachable while scrolled.
//
// Back to top is not lost: clicking the already-active tab does it, and says so in a tooltip.
const CARET_MODES = {
  collapse: { icon: ChevronUp, label: "Hide title" },
  reveal: { icon: ChevronDown, label: "Show title" },
};

/**
 * Whether the tagline's first sentence fits on a single line at the current width.
 *
 * Drives where the second sentence goes, per the rule: if the first sentence fits on one line the second starts
 * a new one; if the first has to wrap, the second continues inline instead. Forcing a break in the wrapped case
 * is what produced an orphaned word on its own line with the next sentence stranded below it.
 *
 * NOT EXPRESSIBLE IN CSS, which is why this measures. The condition depends on whether the RENDERED text fits,
 * a fact only available after layout — a media query would instead have to hardcode "the width at which ~104
 * characters of `text-sm` fit", which is a number that goes stale silently the moment the copy or the type scale
 * changes. `scrollHeight` against a single line's height is the direct question.
 */
function useFitsOneLine(ref) {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    // Compare the rendered height against one line's worth. Line height comes from the computed style rather
    // than a constant so it tracks the responsive `text-xs sm:text-sm` step without being told about it.
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
 * The framework title block. Collapses to zero height rather than being scrolled away.
 *
 * `grid-rows-[1fr]` → `grid-rows-[0fr]` is how the height collapses: a grid row can go from a content-sized
 * track to a zero track, which plain `height: auto` cannot express — and unlike `height: auto`, both ends of
 * that range are interpolatable, so it can be transitioned.
 *
 * The inner item MUST carry `min-h-0` as well as `overflow-hidden`. A grid item's automatic minimum size is
 * its min-content height, which overrides a `0fr` track — so without it the collapsed row keeps a residual
 * band of the title's height.
 *
 * ANIMATED, which it deliberately was not before. The old reasoning was sound for the old design: collapsing
 * was TRIGGERED BY SCROLLING, so transitioning a non-compositable property meant ~18 full-page layout passes
 * (radar chart included) landing precisely while the user was scrolling — a measured stutter. Both premises
 * are gone. Scrolling no longer touches the header, so the only trigger is a caret click: an isolated moment
 * with no competing scroll work, which is exactly when the animation is affordable. And the header is sticky
 * now, so it is on screen when this fires — there IS something to see, where before it was always off-screen.
 *
 * `print:grid-rows-[1fr]` forces it open on paper, and `print:static` keeps it from pinning there.
 */
function AppShellIntro({ collapsed = false }) {
  const taglineProbeRef = useRef(null);
  const taglineFitsOneLine = useFitsOneLine(taglineProbeRef);

  return (
    <div
      id="app-shell-intro"
      aria-hidden={collapsed}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none print:grid-rows-[1fr]",
        collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
    >
      {/* No padding here either — the stack's `pt-3` supplies the gap above the title, and it has to come from
          there rather than from inside this collapsing box so that the corner controls (whose `top-3` resolves
          against that same padding) stay level with the title's first line. */}
      <header className="min-h-0 overflow-hidden text-center">
        {/* `min-h-8` MATCHES THE CORNER ROW. The brand mark and caret are both 32px tall and pinned at the top
            of this stack; the tagline below is full-width, so unless the title's box reaches past them its
            first line runs up alongside the caret. Giving the title at least their height means the tagline
            always starts below the corner row — the clearance is structural rather than a margin tuned by eye,
            so it holds when the title wraps to two lines on narrow screens or the copy changes.

            `mb-1` is enough on top of that. It was briefly `mb-2` to buy the same clearance with a margin,
            which was the wrong lever: it also pushed a two-line title further from the tagline.

            `px-12` keeps the text clear of those same corner items — they are absolutely positioned, so
            centred text has no idea they exist and the title ran straight underneath both. 48px is the caret's
            32px plus its 12px inset, rounded up; the caret is wider than the logo, so clearing it clears both.
            Symmetric even though only the right needs it geometrically: the text is centred, so padding one
            side would drag the optical centre off the card's.

            The tagline is deliberately left full-width — it sits below the corner row, so it cannot collide,
            and indenting the longest text by 96px would cost real height in a header that is now pinned on
            screen permanently.

            No top padding at any width: the `<header>`'s own `pt-3` sets the gap above, and the `sm:pt-2` that
            used to sit here pushed the title out of line with the corner controls from `sm:` up. */}
        <h1
          className="text-balance mx-auto flex min-h-8 w-full items-center justify-center text-xl sm:text-2xl font-bold leading-tight tracking-tight text-slate-900 mb-1 px-12"
          style={HEADER_TEXT_WIDTH_STYLE}
        >
          {SITE_COPY.title}
        </h1>
        {/* Width capped by HEADER_TEXT_WIDTH_STYLE — see that constant for why it reuses the Theory tab's
            measure. `mx-auto` centres the capped block under the title.

            `pb-2` is the whole gap between the byline and the tablist. It was a hair (`pb-0.5 sm:pb-1`) back
            when the tab bar had its own `py-2` above; the bar has no top padding now — its inset comes from the
            stack, which the corner controls' `top-3` is measured against — so anything short here reads as the
            tagline running into the tabs. On the tagline rather than the bar deliberately: inside the
            collapsing grid item it eases away with the intro, whereas on the bar it would survive the collapse
            as a permanent strip.

            THE SECOND SENTENCE BREAKS ONLY IF THE FIRST FITS ON ONE LINE (see `useFitsOneLine`). When the first
            sentence already has to wrap, forcing a break too leaves an orphaned word with the next sentence
            stranded below it; letting it run on instead fills the lines. So the layout is:

              first fits    → `block`, second sentence starts its own line
              first wraps   → `inline`, second sentence continues the flow

            NOT `text-pretty` on the paragraph. That algorithm shortens earlier lines to avoid a short final
            one, and against the byline's unbreakable `whitespace-nowrap` run it produced ragged lines with dead
            space at both ends — the text read as padded even though nothing here has horizontal padding. The
            byline keeps its `nowrap` (a name should not split); it just must not meet an algorithm that reacts
            to it. */}
        <p className="relative mx-auto w-full text-xs sm:text-sm leading-tight text-slate-700 pb-2" style={HEADER_TEXT_WIDTH_STYLE}>
          {/* The measurement PROBE, not the visible text. It is always `block`, so its height answers "would
              this sentence fit on one line here?" independently of what the visible copy is currently doing —
              measuring the real span would be circular, since switching it between `block` and `inline` changes
              the very height the decision is read from, and the two states could oscillate.

              `invisible` rather than `hidden`: it must still be laid out to have a height. Absolutely positioned
              and `aria-hidden` so it costs no space and is not announced twice. */}
          <span ref={taglineProbeRef} aria-hidden className="invisible pointer-events-none absolute inset-x-0 top-0 block">
            {SITE_COPY.tagline}
          </span>
          <span className={cn(taglineFitsOneLine && "block")}>{SITE_COPY.tagline}</span>{" "}
          <span className={cn(taglineFitsOneLine && "block")}>
            {SITE_COPY.detail} <span className="whitespace-nowrap text-slate-500">{SITE_COPY.byline}</span>
          </span>
        </p>
      </header>
    </div>
  );
}

/**
 * Intro + tab bar as ONE sticky unit, pinned at the viewport top at every scroll depth.
 *
 * WHY ONE WRAPPER RATHER THAN TWO STICKIES. Making both sticky independently would put the intro at `top: 0`
 * and the tab bar at `top: <intro height>` — a value that changes across every frame of the intro's
 * animation, so it would have to be written to a CSS var per frame. That is the per-frame layout thrash the
 * intro's old "not animated" comment existed to avoid. Stacking them in normal flow inside a single sticky
 * box means one `top: 0`, no dynamic offset, and one element to measure for `--app-sticky-offset`.
 *
 * WHY STICKY AT ALL. The header used to sit in document flow at position 0, which made its height part of
 * every scroll coordinate on the page: expanding it inserted ~120px above every existing position, so
 * remembered scroll offsets silently meant different content afterwards. A long series of rules tried to
 * correct for that after the fact. Sticky removes the cause — the header occupies viewport space, not
 * document space above the scroll position — which is what lets `useTabScrollMemory` store a plain `scrollY`
 * and lets the toggle animate without fighting anything.
 *
 * `-mx-3 px-3` bleeds to the card's edges past `main`'s own `px-3`. `bg-white` is required, not cosmetic:
 * once this overlaps content it must be opaque, whereas in flow it merely inherited the card's white.
 *
 * THE TOP PADDING IS NOT HERE, and deliberately. It used to live on `main` as `pt-3`, which was wrong for a
 * sticky header — padding on `main` sits above this box, so it scrolled away and left the title flush against
 * the viewport once pinned. Moving it here fixed that but created two new problems: it survived the collapse
 * as a permanent strip above the tab bar, and it shifted the corner items, whose absolute offsets measure from
 * this element's padding box. So it now lives on the intro's own inner `<header>`, where it is clipped by the
 * collapsing row and eases away with it. This box has no vertical padding at all; each child brings its own.
 *
 * NO CORNER RADIUS, for the same reason the page has no vertical black padding any more (see HomePage):
 * rounded top corners are only on screen at `scrollY 0`, so they made the pinned header change shape the
 * moment the user reached the top. A sticky bar has to look identical at every scroll position.
 */
function AppShellHeaderStack({ collapsed, onCollapsedChange, children }) {
  return (
    <div
      id="app-shell-header-stack"
      className={cn(
        // `shadow-sm` sits on THIS box, not on the tab bar. The bar used to be the bottom of the sticky
        // region so its own shadow correctly fell on the content scrolling under it; now it is an in-flow
        // child, so that shadow landed inside this box — cast onto its white background and inset from the
        // card's edges by `px-3`, which drew a visible line partway across the header. The boundary between
        // pinned chrome and scrolling content is this element's bottom edge, so the shadow belongs here.
        // No `relative` needed for the caret to anchor here: `position: sticky` already establishes a
        // containing block for absolutely-positioned children, and adding `relative` would just conflict
        // over the same `position` property.
        // ONE 12px INSET, declared once here rather than on each child: `px-3` and `pt-3`. No `-mx-3` any more
        // — `main` carries no horizontal padding of its own (the tab panels do), so this box already spans the
        // full width and has nothing to cancel.
        //
        // `pt-3` only — NOT `py-3`. Bottom padding would sit between the tab bar and the content below it, and
        // since this box is the boundary the shadow is drawn on, that gap would be permanently visible under the
        // pinned header. The tab bar's own bottom edge is where the chrome should stop.
        //
        // This padding is also what the corner controls' `top-3` resolves against, since absolute offsets are
        // measured from the padding box: `top-3` lands them level with the `h-8` tab-bar row inside the same
        // inset, identically whether the intro is expanded or collapsed — which is what stops them moving when
        // clicked. An earlier version had a conditional `pt-3`/`pt-0` here PLUS `py-3` on the bar, which
        // double-counted and pushed the tablist out of line.
        "sticky top-0 z-40 bg-white px-3 pt-3 shadow-sm print:static print:shadow-none",
      )}
    >
      {children}
      <AppShellBrandMark collapsed={collapsed} />
      <AppShellCaret collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
    </div>
  );
}

// No `collapsed`/`onCollapsedChange` here — the caret owns both and now lives in AppShellHeaderStack.
function AppShellTabBar({ activeTab, onTabChange, theoryHasUnseenUpdates = false }) {
  const barRef = useRef(null);
  // Whether scrolling up is possible — i.e. we're scrolled past the point where the bar pins.
  // Gates the active tab's "click to scroll to top" tooltip so it only shows when it'd do something.
  const [canScrollUp, setCanScrollUp] = useState(false);
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.id === activeTab),
  );

  // Publish how much sticky chrome a scroll target has to clear.
  //
  // Measures the WHOLE STACK (intro + this bar), not just this bar, because both are pinned now — a deep
  // link or pillar jump that only cleared the tab bar would land underneath the title. The stack is the
  // sticky element, so its height is the full inset.
  //
  // Observing it also means the value tracks the intro's expand/collapse animation frame by frame. That is
  // wanted rather than merely tolerated: `scrollBelowStickyHeaderUntilSettled` re-aims each frame while
  // layout moves, so it needs the live inset, not the settled one.
  useLayoutEffect(() => {
    const stack = barRef.current?.parentElement;
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

  // Whether there's anywhere to scroll up to, gating the active tab's "click to scroll to top" tooltip so
  // it only appears when it would do something. Now that the caret is a plain toggle at every depth, this
  // is the ONLY thing scroll position decides in the header.
  useEffect(() => {
    const sync = () => setCanScrollUp(getWindowScrollY() > 0);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [activeTab]);

  return (
    /* No `sticky`/`z-40`/`-mx-3` here any more — AppShellHeaderStack owns all three, for the intro and this
       bar together. This is a plain in-flow child of it. The caret also moved up to the stack, so that
       expanding does not shift it out from under the pointer that just clicked it. */
    /* `pb-3` ONLY — no top padding. The stack's `pt-3` already insets this from above, and the row below is a
       fixed `h-8`, so adding `pt`/`py` here would double-count that inset and drop the tablist below the corner
       controls (which is exactly the bug this arrangement replaced). The bottom 12px is real spacing though: it
       separates the tabs from the content scrolling underneath, and since the stack draws the shadow at its own
       bottom edge, this is what keeps that shadow off the tablist. */
    <div ref={barRef} id="app-shell-tab-bar" className="mt-0 bg-white pb-3">
      {/* The tablist is centered at every width for every user. The brand mark and the caret both live in
          AppShellHeaderStack now, pinned to its corners, so nothing in this row competes with the tablist for
          horizontal space. The admin Poster/Social shortcuts used to float at the right edge here, which
          forced an admin-only `justify-between` on mobile; they now live in the Theory tab's toolbar.

          `h-8` MAKES THIS ROW THE SAME HEIGHT AS THE CORNER CONTROLS, which is what aligns them. The tablist
          is only ~30px tall (`py-1.5` + a `text-xs` line box + its `p-0.5` frame) while the logo and caret are
          exactly 32px, so no amount of matched PADDING lines them up — the boxes are different sizes, and
          earlier attempts to equalise `py` against `top` left them 1-4px out. Pinning the row to 32px and
          letting `items-center` centre a shorter tablist inside it means all three share one centre line by
          construction, whatever the tablist's contents measure. */}
      <div className="relative flex h-8 items-center justify-center">
        <div
          className="relative grid w-62 max-w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
          role="tablist"
          aria-label="App sections"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-md bg-slate-900 shadow-sm transition-transform duration-150 ease-out"
            style={{
              width: "calc(50% - 0.125rem)",
              transform: `translateX(calc(${selectedIndex} * 100%))`,
            }}
          />
          {TABS.map(({ id, label, icon: Icon, version }) => {
            const selected = activeTab === id;
            // Shown on the Theory tab whether or not it's active: opening the tab doesn't clear this
            // dot. It's the aggregate of the per-section dots and stays lit until every changed
            // section has actually been scrolled to (see useTheoryUpdates).
            const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTabChange(id)}
                className={cn(
                  "group relative z-10 flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                  selected ? "text-white" : "text-slate-600 hover:text-slate-800",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
                {version ? (
                  // Version tag sits inline (baseline) with "Theory"; only the unseen-updates dot
                  // floats up as a superscript badge on the version text.
                  <span
                    className={cn("inline-flex items-start text-[11px] font-semibold leading-none", selected ? "text-white/70" : "text-slate-400")}
                  >
                    {version}
                    {/* Unseen-updates dot: at least one changed Theory section hasn't been read yet.
                        `-translate-y` lifts it to superscript height. */}
                    {showUnseenDot ? <UnseenDot label="New framework updates" className="ml-0.5 size-1.5 -translate-y-0.5" /> : null}
                  </span>
                ) : null}
                {selected && canScrollUp ? <Tooltip text="Click to scroll to top" placement="bottom" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The framework's identity mark, pinned to the header stack's top-LEFT as the mirror of {@link AppShellCaret}
 * opposite. Same placement argument: anchored inside the tab bar it rode down with the bar when the intro
 * expanded, so it drifted around the header instead of being a fixed landmark. On the stack's top edge — the
 * one edge `sticky top-0` never lets move — it holds the corner in both header states and at every scroll
 * depth.
 *
 * That permanence is what earns the header the right to stay collapsed indefinitely: nothing expands it
 * automatically any more (see `useHeaderCollapse`), so "collapsed" has to be a space decision rather than the
 * framework going unbranded, and this is what makes that true.
 *
 * A WORDMARK JOINS IT, BUT ONLY WHILE COLLAPSED, AND ONLY FROM `sm:` UP.
 *
 * An unconditional wordmark was tried here first and dropped, for a reason that still holds: while the intro is
 * expanded the <h1> is already on screen, so a second label beside the mark just competes with the centred
 * tablist for horizontal space and repeats what the title is saying two lines below.
 *
 * That argument evaporates when the intro is collapsed. There is no <h1> on screen then — the mark was carrying
 * the app's identity alone, which is what made "collapsed" defensible in the first place (see
 * `useHeaderCollapse`) but also left the pinned bar with no name on it. `SITE_COPY.shortName` is the name at the
 * size the corner can afford, and it costs nothing when it matters least: it appears exactly when the space it
 * would have competed for has been freed by the collapse.
 *
 * THE LOCKUP, NOT A PLAIN LABEL: an oversized `9` with the rest of the name stacked tight beside it, which is
 * the framework's own mark scaled down rather than a second, unrelated piece of typography. It survives the
 * shrink because the numeral does the identifying — the stacked words can go small without the mark stopping
 * being recognisable, which a single run of same-size text could not.
 *
 * TWO LINES, BECAUSE THE ROW IS 32px. The full-size lockup breaks into three ("Pillar Engineer / Growth /
 * Framework"), but the collapsed row is pinned to `h-8` to share a centre line with the tablist and the caret
 * (see AppShellTabBar), and three lines inside 32px lands at ~8.5px type. Two lines is the same shape at a
 * legible size; the reflow lives in `SITE_COPY.shortLockup`.
 *
 * SIZED TO THE LOGO, NOT TO THE ROW: the numeral fills ~86% of the mark's 32px beside it, and the two rows come
 * to just under that and sit centred against it, so the three parts read as one lockup.
 *
 * THE TWO SIZES ARE COUPLED, AND THE COMPARISON IS INK, NOT BOXES. Change one and the other has to follow, in
 * DRAWN height — a digit's ink is ~0.72 of its font size, and a two-line block's ink is `ascender + lineHeight`
 * (~1.85em here) rather than its two line boxes (2.2em), a ~20% difference. Matching the boxes instead is what
 * once left the stack sitting visibly short of the numeral. Both sizes are in `px` with explicit line heights;
 * the inline notes carry the arithmetic.
 *
 * ONE TYPE SIZE AT EVERY WIDTH. This briefly stepped `10px` → `md:11px` on the words, which was not worth it:
 * the smaller size landed where screens are narrowest, i.e. where legibility matters most, and a wordmark that
 * changes size across a breakpoint reads as two marks.
 *
 * HIDDEN BELOW 700px, AN ARBITRARY BREAKPOINT ON PURPOSE. What the threshold has to clear is the centred
 * tablist (`w-62`, 248px), and the width where that stops being a problem falls between Tailwind's steps: the
 * lockup ends ~209px from the left and the tabs begin at `(100vw - 248) / 2`, so `sm:` (640px) overlaps them
 * outright, while `md:` (768px) waits for ~51px of slack — more than the design needs, and it costs the whole
 * 640-767px band the wordmark. 700px leaves ~17px.
 *
 * THAT 17px IS AN ESTIMATE, and the tightest thing in this header. It comes from an assumed average glyph
 * advance of ~0.58em; if the platform's `system-ui` bold sets ~8% wider, the gap closes to ~7px. Dropping the
 * words to 13px restores it to ~17px worst-case, and is the first lever to reach for if the wordmark ever looks
 * crowded against the tabs just above 700px.
 *
 * Both halves of the sum can move — the lockup grows with its type sizes or a longer `shortLockup.lines`, and
 * the tabs' edge moves with `w-62` — so this number is only right for the current pair.
 *
 * CROSS-FADED RATHER THAN SWAPPED, so it arrives with the intro's own 200ms collapse instead of popping in a
 * frame ahead of it. It stays mounted at `opacity-0` when expanded, which is free here: the whole box is already
 * `pointer-events-none` and `aria-hidden`, so an invisible label cannot be clicked, focused, or announced.
 *
 * `aria-hidden`: purely decorative, lockup included. The real, announceable name is the <h1> in AppShellIntro.
 * `BASE_URL`, not a bare "/", because the Pages build serves from /egf/.
 */
function AppShellBrandMark({ collapsed = false }) {
  const { numeral, lines } = SITE_COPY.shortLockup;

  return (
    <div aria-hidden className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 items-center gap-2 print:hidden">
      {/* `size-8` to match the caret opposite. The two bracket the title, so a smaller mark read as
          lopsided against the caret's 32px button. Intrinsic size stays 96px so it stays sharp on
          retina; `rounded-lg` matches the caret's corner radius rather than the mark's own 4px. */}
      <img src={`${import.meta.env.BASE_URL}favicon-96x96.png`} alt="" width={96} height={96} className="size-8 shrink-0 rounded-lg" />
      <span
        className={cn(
          "hidden min-[700px]:flex h-8 items-center gap-1 text-slate-900",
          "transition-opacity duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "opacity-100" : "opacity-0",
        )}
      >
        {/* 38px CARRIES A ~27px DIGIT — the type size is not the glyph height. Lining figures stand to the cap
            height, ~0.72em, so this fills about 86% of the logo's 32px; 42px took it to ~95%, which read too
            heavy next to the mark. `leading-[0.72]` pulls the line box back down to the glyph so a 38px line
            box does not blow out the 32px row and drag the logo off the shared centre line. Cap height varies
            a little by platform font, so treat the ratio as approximate. */}
        <span className="text-[38px] font-black leading-[0.72] tracking-tighter">{numeral}</span>
        {/* CENTRED ON THE NUMERAL, not matched to its full height. A two-line block's drawn height is
            `ascender + lineHeight` (top of line 1's ascenders down to line 2's baseline — neither line has a
            descender), so 14px at `leading-[1.1]` inks ~25.9px against the digit's ~27.4px: a touch shorter, so
            the pair is centred rather than flush top and bottom. Note this is INK, not line boxes — the boxes
            here total 30.8px, about 20% more, and sizing those to the digit instead is what once left the stack
            sitting visibly short of it.
            The parent's `items-center` does the centring, and it lands because each block's ink sits within
            ~0.4px of its own box's centre (checked for both), so centring the boxes centres the ink.
            `translate-y-px` IS AN OPTICAL CORRECTION ON TOP OF THAT, not a fix for the arithmetic. Geometric
            centring measures the ink's bounding box, but the eye weights where the ink actually IS: the digit
            is one solid mass filling its full height, while the stack is two lighter rows with a gap through
            the middle, and against that the two-row block reads a shade high even when its box is centred.
            1px down is the nudge that settles it. Ignore what the numbers say here and trust the eye — if the
            type sizes change, re-judge it rather than recomputing it.
            `items-start` so both lines set flush left against the numeral, as in the full-size mark. */}
        <span className="flex translate-y-px flex-col items-start text-[14px] font-black leading-[1.1] tracking-tight">
          {lines.map((line) => (
            <span key={line} className="whitespace-nowrap">
              {line}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

/**
 * The header toggle. Lives in {@link AppShellHeaderStack} rather than inside the tab bar, and that placement
 * is the whole point.
 *
 * IT MUST NOT MOVE WHEN CLICKED. Anchored inside the tab bar it was `top-1/2` of that bar — so expanding
 * pushed it down by the intro's full height and it slid out from under the pointer that had just clicked it,
 * which makes double-toggling a game of chase. Anchored to the stack's top-right it is fixed relative to the
 * one edge that never moves: the stack is `sticky top-0`, so its top is pinned to the viewport top at every
 * scroll position and in both header states. The button stays exactly where the cursor already is.
 *
 * This is also the discoverable equivalent of nothing else — there is no gesture alternative any more, so it
 * is the only route to the header at any scroll depth.
 *
 *   expanded  → ChevronUp    hide the title
 *   collapsed → ChevronDown  show the title
 *
 * Absolutely positioned so it cannot decentre the tablist below it, which is `justify-center` and would be
 * shoved sideways by an in-flow control.
 *
 * `top-3` UNCONDITIONALLY — the same value expanded or collapsed, which is what keeps this control from moving
 * when clicked. It works out because the tab bar's row is pinned to `h-8`, the same 32px as this button, inside
 * the bar's `py-3`: collapsed, this sits exactly on that row; expanded, the intro's matching `pt-3` puts the
 * title's first line on the same top edge.
 *
 * The failed approach is worth recording, since it looks correct on paper. Matching PADDING (`top-3` against a
 * `py-3` bar) does not align boxes of DIFFERENT heights — the tablist is only ~30px, so equal padding left its
 * centre 1px off and a `py-3` bar pushed it 4px below this button. Fixing the row's height instead makes the
 * alignment structural, so all three share a centre line whatever the tablist's contents measure.
 */
function AppShellCaret({ collapsed, onCollapsedChange }) {
  const { icon: CaretIcon, label: caretLabel } = CARET_MODES[collapsed ? "reveal" : "collapse"];

  return (
    <button
      type="button"
      onClick={() => onCollapsedChange?.(!collapsed)}
      title={caretLabel}
      aria-label={caretLabel}
      aria-expanded={!collapsed}
      aria-controls="app-shell-intro"
      className="absolute right-3 top-3 z-10 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 print:hidden"
    >
      <CaretIcon className="size-4" aria-hidden />
    </button>
  );
}

export { AppShellHeaderStack, AppShellIntro, AppShellTabBar };
