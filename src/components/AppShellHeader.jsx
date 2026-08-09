import { useLayoutEffect, useRef } from "react";

import { InstallPill } from "@/components/InstallPrompt";

import { SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, setStickyScrollOffset } from "@/utils/scroll";

// THE HEADER NO LONGER CARRIES A TITLE BLOCK, AND HAS NO EXPAND/COLLAPSE.
//
// It used to hold the framework title, tagline and byline in a row that could be folded away by a caret. The
// title/tagline now open the Theory tab (see TheoryContent's intro block), which is where they actually explain
// something rather than sitting permanently above the tool. What went with the toggle: the `useHeaderCollapse`
// hook and its sessionStorage bit, the scroll compensation that kept content still while the intro animated
// (`getHeaderToggleDeltaPx`), the caret itself, the tagline's one-line measurement probe, and an entire second
// render of the tagline that existed only so the printed cover could put it below the hero radar while the h1
// stayed above — the header and that radar being in different components, no CSS could interleave them. As
// siblings in the Theory tab they are one `print:order-first` apart.
//
// What is left is a permanent 56px bar: the brand lockup (now the page's <h1>) and the install pill.
//
// SCROLL-TO-TOP USED TO HOLD THAT RIGHT CORNER AND HAS MOVED OUT to a floating button on the Theory tab (see
// ScrollTopFab). Two reasons, and the second is the real one: the install pill needs a permanent home that is
// not inside either tab's scrolling content, and scroll-to-top only ever mattered on the long document. The
// corner was also empty for the whole first screenful (the button was gated on `scrollY > 0`), so a control
// that IS always relevant is a better tenant than one that is usually absent.
//
// DON'T PUT THE TITLE BACK HERE. The bar is pinned at every scroll depth on both tabs, so anything in it is
// paid for on every screen of every page — which is what made a collapsible title necessary in the first
// place, and then made the collapse state something two writers fought over.

/**
 * The whole app header: a 56px bar pinned at the viewport top at every scroll depth, holding the brand lockup
 * and the scroll-to-top button in its two corners.
 *
 * WHY STICKY AT ALL. The header used to sit in document flow at position 0, which made its height part of
 * every scroll coordinate on the page: expanding it inserted ~120px above every existing position, so
 * remembered scroll offsets silently meant different content afterwards. A long series of rules tried to
 * correct for that after the fact. Sticky removes the cause — the header occupies viewport space, not
 * document space above the scroll position — which is what lets `useTabScrollMemory` store a plain `scrollY`.
 *
 * `bg-slate-100` is required TO BE OPAQUE, not merely to be tinted: this overlaps scrolling content, so any
 * transparency would show that content sliding underneath the lockup. It was `bg-white` when the header was in
 * flow and inherited the card's white; the tint is what now distinguishes pinned chrome from the white page below
 * it, which the `shadow-sm` alone was doing.
 *
 * IT IS `100`, NOT `50`, BECAUSE `50` DID NOT READ AS A TINT AT ALL. `slate-50` (#f8fafc) against white is about
 * a 3% luminance step — invisible on most screens, so the chrome went on looking like undifferentiated white and
 * the shadow was still doing all the work. `slate-100` (#f1f5f9) is the first step that actually separates.
 * Do not go back down without checking it on a real display.
 *
 * THE SAME TINT IS ON THE BOTTOM NAV (see AppBottomNav). The two PINNED bars are one surface — the app's chrome —
 * wrapping a white content area; tinting only this one would read as a stray band. If this value changes, change
 * both, plus the four values that are read AGAINST it: the scroll-top button here, and the bottom nav's active
 * segment, inactive hover and unseen-dot rings.
 *
 * AND THE PAGE SURROUND NOW TAKES IT TOO — `body` (index.css) and HomePage's wrapper, which were `bg-black`.
 * `body`'s background propagates to the canvas, so it is what an over-pull past either end of the document
 * reveals: a black gap opening above this header read as a hole behind the chrome rather than as the bar simply
 * continuing. Matching it means the rubber-band shows more of this same surface. So this value now has SIX
 * dependents, not four — the two above plus these — and the two new ones want the tint IDENTICAL rather than
 * merely legible against it. If it changes, they change with it.
 *
 * THE FOOTER IS NOT PART OF IT ANY MORE. It carried this tint for a while and gave it up — it is in flow, so it is
 * content, and its band plus hairline only duplicated the boundary the nav's shadow already draws. See HomePage.
 *
 * `p-3` — ONE 12px INSET ON ALL FOUR SIDES, declared once here. Both vertical halves used to live on children,
 * which meant the header's inset was assembled from three files and none of them owned it. It is this element's
 * padding, so it belongs on this element. It is also what the corner controls' `top-3` resolves against, since
 * absolute offsets are measured from the padding box.
 *
 * `min-h-14` IS THE HEADER'S ENTIRE HEIGHT. Both children are ABSOLUTELY POSITIONED, so they contribute none of
 * it; without this floor the box would collapse to its 24px of padding while the 32px controls inside overflowed
 * it — painting over the content below, with the shadow cutting across them. 56px is `12 + 32 + 12`: the
 * controls' height inside the padding they sit in. It stays a `min-height` rather than a fixed one so nothing
 * here has to be re-tuned if a taller control ever lands in the row.
 *
 * `print:hidden` — THE HEADER DOES NOT PRINT AT ALL. Both children are print-hidden individually anyway, so all
 * that reached paper was this box's own 56px of padding and floor: a blank band above the Theory tab's cover
 * page. The printed title lives in that cover block instead (see TheoryContent), which is also why the
 * `printCoverOffset` prop that used to centre this on the first sheet is gone — the offset belongs on the block
 * being centred, not on a header that is no longer part of it.
 *
 * NO CORNER RADIUS, for the same reason the page has no vertical black padding any more (see HomePage):
 * rounded top corners are only on screen at `scrollY 0`, so they made the pinned header change shape the
 * moment the user reached the top. A sticky bar has to look identical at every scroll position.
 */
function AppShellHeaderStack() {
  const stackRef = useRef(null);

  // Publish how much pinned chrome a scroll target has to clear, so deep links and pillar jumps land BELOW the
  // header rather than underneath it. This is measured on the sticky element itself — it used to be read off a
  // child's `parentElement`, which meant the value depended on that child staying a direct descendant.
  //
  // STILL OBSERVED even though the height is now constant: the observer is what makes that a fact about the
  // rendered box rather than an assumption, and `scrollBelowStickyHeaderUntilSettled` re-aims each frame while
  // layout moves, so it wants the live inset regardless.
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
      // `shadow-sm` AND `border-b` BOTH SIT ON THIS BOX, and they are not redundant. The boundary between
      // pinned chrome and scrolling content is this element's bottom edge, so both belong here — on a child the
      // shadow was cast onto this box's own background and inset from the card's edges, which drew a visible
      // line partway across the header.
      //
      // Three things doing three jobs at one edge: the TINT says "this is chrome, not page", the BORDER draws
      // the edge crisply at rest (a tint boundary alone is a soft gradient the eye reads as a smudge), and the
      // SHADOW says "it floats above what is scrolling under it". Drop the border and the edge goes mushy on a
      // light background; drop the shadow and the bar looks glued to the content rather than over it.
      // No `relative` needed for the corner controls to anchor here: `position: sticky` already establishes a
      // containing block for absolutely-positioned children, and adding `relative` would just conflict over
      // the same `position` property.
      //
      // No `-mx-3`: `main` carries no horizontal padding of its own (the tab panels do), so this box already
      // spans the full width and has nothing to cancel.
      //
      // See the docblock for `p-3`, `min-h-14` and `print:hidden` — between them they are the entire geometry
      // of the header, and none of it belongs on a child.
      className="sticky top-0 z-40 min-h-14 border-b border-slate-200 bg-slate-100 p-3 shadow-sm print:hidden"
    >
      <AppShellBrandMark />
      {/* Renders nothing unless this browser can actually install the app, so the corner is simply empty on a
          desktop browser with no install path and on an already-installed PWA — see InstallPrompt's InstallPill.
          That is the same "absent rather than inert" rule the scroll-top button followed when it lived here. */}
      <InstallPill />
    </div>
  );
}

/**
 * The stacked words of the brand lockup (see AppShellBrandMark).
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
 * but `flex` is not — the caller supplies that.
 */
const WORDS_CLASS = "flex-col items-start text-[14px] font-black leading-[1.1] tracking-tight";

/**
 * The framework's identity mark, pinned to the header stack's top-LEFT, and THE PAGE'S <h1>.
 *
 * IT CARRIES THE DOCUMENT TITLE because nothing else can. This used to be decorative and `aria-hidden`, with the
 * real h1 in the header's title block; that block now opens the Theory tab instead — and the Theory panel is
 * `hidden` while the tool tab is active, so an h1 living only there would leave the tool tab with no heading in
 * the accessibility tree at all. Here it is announced on both tabs at every scroll depth.
 *
 * The LOCKUP ITSELF STAYS `aria-hidden`, with an `sr-only` span carrying `SITE_COPY.title` beside it: a screen
 * reader should hear "9-Pillar Engineer Growth Framework", not a stray numeral followed by two half-names.
 *
 * WHY THE MARK LIVES IN THE CORNER. Anchored inside the tab bar it rode down with the bar when the header's old
 * title block expanded, so it drifted around instead of being a fixed landmark. On the stack's top edge — the one
 * edge `sticky top-0` never lets move — it holds its corner at every scroll depth.
 *
 * THE WORDMARK IS UNCONDITIONAL. It used to appear only while the title block was collapsed, since a second label
 * beside the mark would otherwise repeat what the h1 was saying two lines below and compete with a centred tablist
 * for the width. Neither exists any more: there is no title block to repeat and nothing else in the row.
 *
 * THE LOCKUP, NOT A PLAIN LABEL: an oversized `9` with the rest of the name stacked tight beside it, which is
 * the framework's own mark scaled down rather than a second, unrelated piece of typography. It survives the
 * shrink because the numeral does the identifying — the stacked words can go small without the mark stopping
 * being recognisable, which a single run of same-size text could not.
 *
 * THE LOCKUP, NOT A PLAIN LABEL: an oversized `9` with the rest of the name stacked tight beside it, which is
 * the framework's own mark scaled down rather than a second, unrelated piece of typography. It survives the
 * shrink because the numeral does the identifying — the stacked words can go small without the mark stopping
 * being recognisable, which a single run of same-size text could not.
 *
 * TWO LINES, BECAUSE THE ROW IS 32px. The full-size lockup breaks into three ("Pillar Engineer / Growth /
 * Framework"), but this mark is a 32px box sharing a centre line with the scroll-to-top button opposite, and three
 * lines inside 32px lands at ~8.5px type. Two lines is the same shape at a legible size; the reflow lives in
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
 * NO BREAKPOINTS AT ALL — one form at every width.
 *
 * This used to be the most fiddly geometry in the file. The lockup shared its row with a centred segmented
 * control, so what it could show depended on a sum of that control's width, the caret's inset and the row's
 * padding — `12 + ((100vw - 24) - 248) / 2` at one point — and the answer was two hand-measured thresholds
 * (hidden below 510px, abbreviated below 700px, later 470px) that went stale whenever any term moved. Adding a
 * third tab would have moved a term.
 *
 * Moving navigation to the viewport bottom (see AppBottomNav) removed every term. The row now holds this mark and
 * one 32px button, so the space available is `100vw - 12 - 32 - 12` minus the lockup's own `12 + 32 (logo) + 8
 * (gap)` — about `100vw - 108`. The words run ~145px, so it fits from ~253px, comfortably below the app's 350px
 * floor (`FE_UI.page.minWidthPx`, enforced on `main` in HomePage). There is no width the app supports at which the
 * full lockup does not fit, so there is nothing to switch on.
 *
 * KEEP IT THAT WAY. If something is ever added back to this row, the honest move is to put it on its own line or
 * at the bottom rather than to reintroduce a measured threshold here — that is the trade this change was made to
 * escape.
 *
 * `print:hidden` — the printed cover carries the framework's full title as text instead (see TheoryContent);
 * a 14px corner lockup on a paper cover would be a screen artifact, not a mark.
 *
 * `BASE_URL`, not a bare "/", because the Pages build serves from /egf/.
 */
function AppShellBrandMark() {
  const { numeral, lines } = SITE_COPY.shortLockup;

  return (
    // `pointer-events-none`: the h1 is a landmark, not a control — nothing here is clickable, and letting it
    // swallow pointer events over the header's left corner would be the only effect it could have.
    <h1 className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 items-center gap-2 print:hidden">
      {/* THE ANNOUNCED NAME. The lockup beside it is `aria-hidden` — it splits the title across a numeral and
          two half-lines for visual reasons, which is not what a screen reader should read out. */}
      <span className="sr-only">{SITE_COPY.title}</span>
      {/* `size-8` to match the button opposite. The two bracket the bar, so a smaller mark read as lopsided
          against a 32px button. Intrinsic size stays 96px so it stays sharp on retina; `rounded-lg` matches
          that button's corner radius rather than the mark's own 4px. */}
      <img src={`${import.meta.env.BASE_URL}favicon-96x96.png`} alt="" aria-hidden width={96} height={96} className="size-8 shrink-0 rounded-lg" />
      {/* NO WIDTH GATE and no opacity state — a plain `flex`. This used to hide below 510px (a centred 248px
          tablist left the corner ~39px) and later cross-fade in only while the header's title block was
          collapsed. Neither condition exists now: see the docblock. */}
      <span aria-hidden className="flex h-8 items-center gap-1 text-slate-900">
        {/* 38px CARRIES A ~27px DIGIT — the type size is not the glyph height. Lining figures stand to the cap
            height, ~0.72em, so this fills about 86% of the logo's 32px; 42px took it to ~95%, which read too
            heavy next to the mark. `leading-[0.72]` pulls the line box back down to the glyph so a 38px line
            box does not blow out the 32px row and drag the logo off the shared centre line. Cap height varies
            a little by platform font, so treat the ratio as approximate. */}
        <span className="text-[38px] font-black leading-[0.72] tracking-tighter">{numeral}</span>
        {/* `WORDS_CLASS` carries the sizing and the 1px optical nudge. */}
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
