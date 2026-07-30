import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronDown, ChevronsUp, ChevronUp } from "lucide-react";

import { FE_UI, FRAMEWORK_VERSION, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, getWindowScrollY, scrollWindowToTop, setStickyScrollOffset } from "@/utils/scroll";

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
      {/* No padding here — the stack's `p-3` supplies the gap on every side, and the vertical half of it has to
          come from there rather than from inside this collapsing box so that the corner controls (whose `top-3`
          resolves against that same padding) stay level with the title's first line. */}
      <header className="min-h-0 overflow-hidden text-center">
        {/* `min-h-8` MATCHES THE CORNER ROW. The brand mark and caret are both 32px tall and pinned at the top
            of this stack; the tagline below is full-width, so unless the title's box reaches past them its
            first line runs up alongside the caret. Giving the title at least their height means the tagline
            always starts below the corner row — the clearance is structural rather than a margin tuned by eye,
            so it holds when the title wraps to two lines on narrow screens or the copy changes.

            `mb-1` is enough on top of that. It was briefly `mb-2` to buy the same clearance with a margin,
            which was the wrong lever: it also pushed a two-line title further from the tagline.

            `px-20` keeps the text clear of those same corner items — they are absolutely positioned, so centred
            text has no idea they exist and the title ran straight underneath them. 80px covers the WIDER of the
            two corners: the right now holds two 32px buttons (scroll-to-top and the caret) with a 4px gap, so
            `12 + 32 + 4 + 32` = 80. It was 48px when the caret was alone there.

            Symmetric even though only the right needs it geometrically: the text is centred, so padding one side
            would drag the optical centre off the card's.

            UNCONDITIONAL, even though the scroll-to-top button only exists while the page is scrolled. Making the
            padding track that would reflow — and re-centre — the title on the first pixel of scroll, which is far
            more noticeable than 32px of unused measure on a title that is capped at 900px and centred anyway.

            The tagline is deliberately left full-width — it sits below the corner row, so it cannot collide,
            and indenting the longest text by 96px would cost real height in a header that is now pinned on
            screen permanently.

            No top padding at any width: the stack's `p-3` sets the gap above, and the `sm:pt-2` that used to sit
            here pushed the title out of line with the corner controls from `sm:` up. */}
        {/* `print:mb-[5vh]` opens the cover page up. On screen this sits 4px above the tagline in a header
            that is permanently pinned, where every pixel of height is spent all the time; on the printed
            cover the next thing down is the hero radar with a whole sheet to itself, so the pair reads as a
            title and a plate rather than a heading jammed against a chart. Paired with the matching space
            above the tagline below the radar — see AppShellPrintTagline. */}
        <h1
          className="text-balance mx-auto flex min-h-8 w-full flex-col items-center justify-center text-xl sm:text-2xl font-extrabold leading-tight tracking-tight text-slate-900 mb-1 px-20 print:mb-[5vh]"
          style={HEADER_TEXT_WIDTH_STYLE}
        >
          <span>{SITE_COPY.title}</span>
          <span className="hidden text-xl font-extrabold leading-tight tracking-tight text-slate-900 print:block">v{FRAMEWORK_VERSION}</span>
        </h1>
        {/* Width capped by HEADER_TEXT_WIDTH_STYLE — see that constant for why it reuses the Theory tab's
            measure. `mx-auto` centres the capped block under the title.

            NO BOTTOM PADDING. This carried `pb-2` to hold the byline off the tablist that used to sit below it;
            with navigation gone (see AppBottomNav) the next thing down is the stack's own `p-3`, which already
            supplies that gap. Adding to it here would just make the expanded header taller than it needs to be.

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
        {/* `print:hidden` — ON PAPER THIS PARAGRAPH MOVES BELOW THE HERO RADAR. The printed cover reads
            title → chart → tagline/byline, so the h1 above stays put and this half is re-rendered under the
            chart by AppShellPrintTagline. Only the layout is duplicated, never the copy: both read the same
            SITE_COPY. */}
        <p className="relative mx-auto w-full text-xs sm:text-sm leading-tight text-slate-700 print:hidden" style={HEADER_TEXT_WIDTH_STYLE}>
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
 * `p-3` — ONE 12px INSET ON ALL FOUR SIDES, declared once here. Both vertical halves used to live on children
 * (the intro's `pt-3`, then a `mb-3` on a spacer element below it), which meant the header's inset was assembled
 * from three files and none of them owned it. It is this element's padding, so it belongs on this element.
 *
 * It is also what the corner controls' `top-3` resolves against, since absolute offsets are measured from the
 * padding box: `top-3` lands them at the top of the padding box identically whether the intro is expanded or
 * collapsed, which is what stops them moving when clicked.
 *
 * `min-h-14` RESERVES THE CORNER ROW, and is what makes the collapsed header hold its own contents. The brand
 * mark and the caret are both ABSOLUTELY POSITIONED, so they contribute NO height; the intro is the only child
 * that does, and collapsing takes it to zero. Without a floor the collapsed box would shrink to its 24px of
 * padding while the 32px controls inside overflowed it — painting over the content below, with the shadow cutting
 * across them. 56px is `12 + 32 + 12`: the controls' height inside the padding they sit in.
 *
 * Expanded, the intro is taller than that floor, so `min-h-14` is inert — it only binds at the collapsed end,
 * which is why it can be unconditional. That is the whole reason this is a `min-height` and not a fixed one, and
 * why an earlier attempt with a conditionally-sized spacer child was the wrong shape: a spacer is an in-flow
 * sibling, so its height ADDED to the expanded intro rather than being absorbed by it, leaving a permanent band
 * of blank white under the tagline.
 *
 * NO CORNER RADIUS, for the same reason the page has no vertical black padding any more (see HomePage):
 * rounded top corners are only on screen at `scrollY 0`, so they made the pinned header change shape the
 * moment the user reached the top. A sticky bar has to look identical at every scroll position.
 */
/**
 * The tagline/byline half of the intro, for the PRINTED COVER ONLY, where it sits BELOW the hero radar
 * while the h1 stays above it (see AppShellIntro's `print:hidden` on its own copy of this paragraph, and
 * TheoryContent for where this renders). Invisible on screen — there the header carries the whole intro.
 *
 * A second render rather than reordering, because in `main`'s flex column the header and the tab panels are
 * siblings: `order` could only move the whole header before or after a whole panel, and the radar this must
 * follow is nested several levels inside one. No CSS interleaves them. The copy is not duplicated — both
 * this and AppShellIntro read the same SITE_COPY.
 *
 * `px-[15vw]` narrows the measure: `vh`/`vw` resolve against the page box in print, and the header's
 * on-screen cap sets a line far too long to track on a printed sheet.
 *
 * The byline is on its OWN line here, unlike in the header where it runs on after `detail` — a cover page
 * has vertical room to spend, and attribution reads as a credit line rather than a trailing clause.
 */
function AppShellPrintTagline() {
  /* `mt-[5vh]` is not `print:`-prefixed because the whole block is print-only. It mirrors the h1's
     `print:mb-[5vh]` on the other side of the radar, so the chart sits in equal space rather than being
     crowded by the text above and below it. */
  return (
    <p className="hidden px-[15vw] text-center text-base leading-tight text-slate-700 mt-[5vh] print:block">
      {SITE_COPY.tagline} {SITE_COPY.detail}
      <span className="mt-1 block whitespace-nowrap text-slate-500">{SITE_COPY.byline}</span>
    </p>
  );
}

/**
 * `printCoverOffset` pushes the header down the first printed sheet so that its h1, the hero radar below it
 * and that radar's tagline read as one block near the middle of a cover page, rather than pinned to the top
 * with the rest of the sheet empty. Off by default: the tool tab prints as a compact chart-plus-form
 * document and wants no cover page at all, so only the caller knows.
 */
function AppShellHeaderStack({ collapsed, onCollapsedChange, printCoverOffset = false, children }) {
  const stackRef = useRef(null);

  // Publish how much pinned chrome a scroll target has to clear, so deep links and pillar jumps land BELOW the
  // header rather than underneath it. This is measured on the sticky element itself — it used to be read off a
  // child's `parentElement`, which meant the value depended on that child staying a direct descendant.
  //
  // Observing it means the value tracks the intro's expand/collapse animation frame by frame. That is wanted
  // rather than merely tolerated: `scrollBelowStickyHeaderUntilSettled` re-aims each frame while layout moves,
  // so it needs the live inset, not the settled one.
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
      className={cn(
        // `shadow-sm` sits on THIS box, not on the tab bar. The bar used to be the bottom of the sticky
        // region so its own shadow correctly fell on the content scrolling under it; now it is an in-flow
        // child, so that shadow landed inside this box — cast onto its white background and inset from the
        // card's edges by `px-3`, which drew a visible line partway across the header. The boundary between
        // pinned chrome and scrolling content is this element's bottom edge, so the shadow belongs here.
        // No `relative` needed for the caret to anchor here: `position: sticky` already establishes a
        // containing block for absolutely-positioned children, and adding `relative` would just conflict
        // over the same `position` property.
        //
        // No `-mx-3`: `main` carries no horizontal padding of its own (the tab panels do), so this box already
        // spans the full width and has nothing to cancel.
        //
        // See the docblock for `p-3` and `min-h-14` — between them they are the entire vertical geometry of the
        // header, and neither belongs on a child.
        "sticky top-0 z-40 min-h-14 bg-white p-3 shadow-sm print:static print:shadow-none",
        // A RESERVE, NOT A MEASUREMENT. `vh` is the page box in print, but the height of the block being
        // centred is content-driven — the intro prints expanded and its tagline wraps to its own measure,
        // and the radar below is sized at runtime — so there is nothing to measure against from here.
        // This leaves the pair a little above true centre, which is the safe direction: overflow the sheet
        // by even a pixel and the cover page becomes two.
        printCoverOffset && "print:mt-[18vh]",
      )}
    >
      {children}
      <AppShellBrandMark collapsed={collapsed} />
      <AppShellScrollTopButton />
      <AppShellCaret collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
    </div>
  );
}

/**
 * The stacked words of the brand lockup, shared by its wide and abbreviated variants (see AppShellBrandMark) so
 * the two can only differ in their copy.
 *
 * CENTRED ON THE NUMERAL, not matched to its full height. A two-line block's drawn height is
 * `ascender + lineHeight` — top of line 1's ascenders down to line 2's baseline, neither line having a descender
 * — so 14px at `leading-[1.1]` inks ~25.9px against the digit's ~27.4px: a touch shorter, hence centred rather
 * than flush top and bottom. That is INK, not line boxes: the boxes total 30.8px, about 20% more, and sizing
 * THOSE to the digit is what once left the stack sitting visibly short of it.
 *
 * The parent's `items-center` does the centring, and it lands because each block's ink sits within ~0.4px of its
 * own box's centre (checked for both), so centring the boxes centres the ink.
 *
 * `translate-y-px` IS AN OPTICAL CORRECTION ON TOP OF THAT, not a fix for the arithmetic — and a transform
 * rather than a margin, so it moves the painted result without changing the box the centring is computed from.
 * Geometric centring aligns bounding boxes, but the eye weights where the ink actually is: the digit is one
 * solid mass filling its height, while the stack is two lighter rows with a gap through the middle, and against
 * that the stack reads a shade high even when its box is centred. Trust the eye over the numbers here; if the
 * type sizes change, re-judge the nudge rather than recomputing it.
 *
 * `items-start` so both lines set flush left against the numeral, as in the full-size mark. `flex-col` is here
 * but `flex`/`hidden` is not — that is what each variant supplies to select itself.
 */
const WORDS_CLASS = "flex-col items-start text-[14px] font-black leading-[1.1] tracking-tight";

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
 * A WORDMARK JOINS IT WHILE COLLAPSED, AT EVERY WIDTH. Collapse is the only condition — there is no longer a
 * lower width gate (it used to hide below 510px; see the breakpoint note further down for what changed).
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
 * Framework"), but this mark is a 32px box sharing a centre line with the caret opposite, and three lines inside
 * 32px lands at ~8.5px type. Two lines is the same shape at a legible size; the reflow lives in
 * `SITE_COPY.shortLockup`.
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
 * NO BREAKPOINTS AT ALL — the wide form shows at every width, and the abbreviated one is dead code kept only
 * because `SITE_COPY.shortLockup.compactLines` still describes it.
 *
 * This used to be the most fiddly geometry in the file. The lockup shared its row with a centred segmented
 * control, so what it could show depended on a sum of that control's width, the caret's inset and the row's
 * padding — `12 + ((100vw - 24) - 248) / 2` at one point — and the answer was two hand-measured thresholds
 * (hidden below 510px, abbreviated below 700px, later 470px) that went stale whenever any term moved. Adding a
 * third tab would have moved a term.
 *
 * Moving navigation to the viewport bottom (see AppBottomNav) removed every term. The row now holds the lockup
 * and the caret, nothing else, so the space available is `100vw - 12 - 32 (caret) - 12` minus the lockup's own
 * `12 + 32 (logo) + 8 (gap)` — about `100vw - 108`. The wide form's words run ~145px, so it fits from ~253px,
 * comfortably below the app's 350px floor (`FE_UI.page.minWidthPx`, enforced on `main` in HomePage). There is no
 * width the app supports at which the full lockup does not fit, so there is nothing to switch on.
 *
 * KEEP IT THAT WAY. If something is ever added back to this row, the honest move is to put it on its own line or
 * at the bottom rather than to reintroduce a measured threshold here — that is the trade this change was made to
 * escape.
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
      {/* NO WIDTH GATE — a plain `flex`, with no `hidden` plus a min-width variant to switch it on. (Written out
          rather than shown as a class, because Tailwind scans comments too and would generate a broken rule from
          a placeholder breakpoint.) The wordmark used to hide below 510px because a
          centred 248px tablist left the corner ~39px; right-aligned and content-sized it leaves enough for the
          compact form at the app's narrowest supported layout, so there is no width at which hiding it is the
          right answer. Only `collapsed` decides whether it shows. */}
      <span
        className={cn(
          "flex h-8 items-center gap-1 text-slate-900",
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
        {/* ONE VARIANT NOW. `compactLines` is no longer rendered anywhere: with navigation out of this row the
            wide form fits at every supported width (see the docblock), so switching between them would be a
            threshold with nothing to protect against. The copy stays in SITE_COPY.shortLockup in case a future
            layout needs it again.

            `WORDS_CLASS` carries the sizing and the 1px optical nudge. */}
        <span className={cn(WORDS_CLASS, "flex")}>
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
 * Absolutely positioned, which is now about this button alone: there is no longer a tablist in the row for an
 * in-flow control to shove sideways, but the reason above still stands on its own.
 *
 * IT STAYS ABSOLUTE RATHER THAN IN FLOW. An in-flow button at the end of the header's bottom strip would read the
 * same and be less machinery — but that strip sits BELOW the collapsing intro, so expanding would carry the
 * button down by the intro's full height and hand back exactly the bug described above.
 *
 * `top-3` UNCONDITIONALLY — the same value expanded or collapsed, which is what keeps this control from moving
 * when clicked. Collapsed, the stack's `p-3` puts this at the top of a header whose intro has gone to zero
 * height; expanded, that same padding puts the title's first line on the same top edge.
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

/**
 * Scroll to the top of the page. Sits immediately left of {@link AppShellCaret}, in the same 32px corner row.
 *
 * IT ONLY EXISTS WHILE THERE IS SOMEWHERE TO GO. Gated on `scrollY > 0`, so at the top of the page the corner
 * holds the caret alone. A control that is always present but does nothing for the whole first screenful is worse
 * than no control: it teaches that pressing it has no effect, which is the lesson that then applies when it would
 * have worked.
 *
 * THIS REPLACES A HIDDEN GESTURE. Scroll-to-top used to be "tap the tab you are already on", announced by a
 * tooltip on hover. That was defensible while navigation was a segmented control beside the title — the tabs and
 * the title were the same piece of chrome — but navigation moved to a bottom bar (see AppBottomNav), where the
 * active item is the easiest thing on screen to hit by accident and there is no hover to advertise anything. So
 * the behaviour was removed from the tap and given its own button here, where it is visible rather than secret.
 *
 * LEFT OF THE CARET, NOT RIGHT. The caret keeps the true corner and therefore its exact position, which is what
 * its own docblock is about: it must not move when clicked. Taking the corner for this button would shift the
 * caret 36px inboard and break that for a control users have already learned.
 *
 * A DOUBLE CHEVRON, deliberately distinct from the caret's single one. The two sit 4px apart doing different
 * things — one moves the page, one folds the header — and at 16px a repeated glyph reads as "further, all the
 * way" against the single glyph's "one step". Same size, border and hover treatment otherwise, because they are
 * peers in the same row.
 *
 * `smooth`, unlike the instant scrolls elsewhere in the app: those are restores and jumps that should feel like
 * the page was always there, whereas this is a journey the user asked for and the motion is the feedback that it
 * happened. `motion-reduce` is honoured by the browser's own `scroll-behavior` handling of `smooth`.
 */
function AppShellScrollTopButton() {
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

  // Unmounted rather than hidden: there is nothing to animate to or from, and an invisible button in the corner
  // would still be in the tab order.
  if (!canScrollUp) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => scrollWindowToTop({ behavior: "smooth" })}
      title="Scroll to top"
      aria-label="Scroll to top"
      // `right-12` = 48px: the caret's own 12px inset plus its 32px width, plus a 4px gap. So this sits directly
      // inboard of it in the same row, sharing `top-3` so the two are on one centre line.
      className="absolute right-12 top-3 z-10 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 print:hidden"
    >
      <ChevronsUp className="size-4" aria-hidden />
    </button>
  );
}

export { AppShellHeaderStack, AppShellIntro, AppShellPrintTagline };
