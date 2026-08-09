import { FileText, Radar, Wrench } from "lucide-react";

import { AdminLockBadge } from "@/components/AdminLockBadge";
import { UnseenDot } from "@/components/UnseenDot";

import { FRAMEWORK_VERSION, IS_ADMIN } from "@/constants";
import { cn } from "@/utils";

/**
 * The app's primary navigation. The first two are the same destinations the header's segmented control used to
 * hold; `version` still derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot (see
 * useTheoryUpdates) cannot disagree.
 *
 * ADMIN IS APPENDED, NOT CONDITIONALLY RENDERED IN THE ROW BELOW, so the map stays a plain list and the items'
 * `flex-1` does the rest: two tabs split the bar in half, three split it in thirds, and nothing else changes.
 * This list and HomePage's VALID_TABS are the two places the tab is gated — see AdminContent.
 *
 * `adminOnly` IS A PROPERTY OF THE ITEM, not a test on `id === "admin"` at the render site. It marks the tab as
 * absent from the public build (see AdminLockBadge), which is a fact about how it is gated rather than about
 * which tab it happens to be — so a second gated tab is one more flag here and nothing else.
 */
const NAV_ITEMS = [
  { id: "tool", label: "Tool", icon: Radar },
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
  ...(IS_ADMIN ? [{ id: "admin", label: "Admin", icon: Wrench, adminOnly: true }] : []),
];

/**
 * Primary navigation, pinned to the bottom of the viewport at every width.
 *
 * WHY IT LEFT THE HEADER. It was a segmented control in the header's 32px row, sharing that row with the brand
 * lockup and the collapse caret — three jobs in one row, and at the app's 350px floor the three did not fit.
 * Everything the old arrangement had to do to cope was a symptom of that: the tablist shrank to content width,
 * slid between centred and flush-right depending on the header's state, reserved the caret's corner with
 * `pr-11`, and the wordmark beside it needed hand-measured breakpoints (470px, re-measured twice) to know when
 * to abbreviate. Moving navigation out of the row deletes all of it — the header is brand + caret, which fits
 * at any width, and the lockup never abbreviates again.
 *
 * It also stops the tab count from being a layout constraint. In the header, a third tab meant re-measuring the
 * wordmark's breakpoint; here the bar is full-width and the items share it, so tabs can be added without
 * touching anything else.
 *
 * A BOTTOM BAR RATHER THAN A SECOND HEADER ROW, because it is reachable: on a phone this sits under the thumb,
 * whereas a second row at the top is the furthest point from it. `fixed` rather than `sticky` — sticky would
 * need a scroll container to stick within and would scroll away with the document at the end of a short page,
 * which for the app's only navigation is not acceptable.
 *
 * AT EVERY WIDTH, not mobile-only. The alternative kept the segmented control in the header for wide screens,
 * which would have meant maintaining two navigation surfaces and keeping every piece of geometry this change
 * exists to delete. One implementation, one place to change.
 *
 * `pb-[env(safe-area-inset-bottom)]` KEEPS IT CLEAR OF THE iOS HOME BAR. On a notched iPhone the bottom ~34px is
 * the system gesture area; without this the labels sit under it and a tap near them is taken by the system swipe
 * rather than the tab.
 *
 * TWO THINGS IN index.html HAVE TO BE TRUE FOR THAT env() TO BE NON-ZERO, and it silently resolves to 0 if either
 * is missing:
 *
 *   1. `viewport-fit=cover` on the viewport meta — otherwise the page is laid out inside the safe area already and
 *      there is no inset to report.
 *   2. `apple-mobile-web-app-capable` — iOS reports 0 for every inset while browser chrome is present, because
 *      Safari's own bottom bar is what is clearing the home indicator. This was missing, which meant the padding
 *      here did nothing on iOS no matter how the app was launched.
 *
 * Note (2) only takes effect for home-screen icons created AFTER it shipped: iOS bakes the launch mode into the
 * shortcut when it is added.
 *
 * THE PADDING IS ON THE BAR, NOT THE ROW, so the bar's background and its shadow extend into the inset while the
 * row of `min-h-14` touch targets sits entirely above it. Putting it on the row instead would pad the targets from
 * below — the bar would be the right height, but the bottom 34px of it would be dead space that looks tappable.
 *
 * `bg-slate-100` MATCHES THE HEADER, and the two values are one decision (see AppShellHeader's docblock, which
 * carries the reasoning for the level). Both were white, which left the shell defined by shadows alone; the tint is
 * what separates pinned chrome from the white content between it. It also has to be OPAQUE for the same reason the
 * header's does — scrolling content passes underneath this bar.
 *
 * THE FOOTER USED TO CARRY IT TOO AND NO LONGER DOES (see HomePage). The tinted surface is the two PINNED bars; the
 * footer is in flow and is content, so it kept `main`'s white. Nothing here had to change when it went — this bar's
 * top edge meets white either way, and the shadow below already handles that.
 *
 * THE TINT COST THIS FILE THREE MORE VALUES, not just the one: the active segment, the inactive hover, and the
 * unseen dot's ring are all read AGAINST the bar, so each had to move up with it to keep its separation. See
 * their notes below. That coupling is the reason to change the bar's value in all four places at once or not at
 * all — and the hover is the one that fails loudest, since a hover equal to its own background does nothing.
 *
 * `print:hidden`: navigation is meaningless on paper, and the printed page already carries the header's title.
 */
export function AppBottomNav({ activeTab, onTabChange, theoryHasUnseenUpdates = false }) {
  return (
    /* `z-40` MATCHES THE HEADER STACK, deliberately: the two are the same kind of thing (pinned app chrome), and
       both sit below the `z-50` popovers (ProfileCombobox, ProfileActionsMenu) so a dropdown is never painted
       behind the bar it needs to overlap.

       AN UPWARD SHADOW, MIRRORING THE HEADER'S. The header is `shadow-sm`, which casts DOWN onto the content
       scrolling beneath it; this bar's boundary faces the other way, so it needs the same shadow negated in Y.
       Tailwind has no utility for that (every `shadow-*` casts downward), hence the arbitrary value — it is
       `shadow-sm`'s own two layers with the offsets and spread flipped, so the two bars read as the same weight
       of chrome rather than one being heavier than the other.

       STILL NO `border-t` HERE, EVEN THOUGH THE HEADER GAINED A `border-b`, AND THE SHADOW IS WHY. This had a
       hairline first, and a hairline is a seam between two flat areas — it made the bar look pasted onto whatever
       was above it. The shadow lifts it off instead, which is the relationship that is actually true: this floats
       above a scrolling page. That is not the header's situation. Its border marks where the page's content BEGINS
       under a bar that is flush with the top edge of the viewport; this bar has a whole page below nothing.

       IT IS ALSO THE ONLY BOTTOM BOUNDARY, and that is deliberate. The footer above once carried this bar's tint
       plus a `border-t` of its own, which put a second separator 56px up from this shadow; the footer dropped both
       (see HomePage), so the shadow against white is the one edge on this side of the page. Adding a `border-t`
       here would rebuild the doubling from the other direction.

       NO `transform-gpu` HERE, AND THE FIX FOR THE TAB-SWITCH JUMP IS NOT IN THIS FILE. A compositor-layer
       promotion here looks like the fix and is not; it only makes the symptom cheaper to repaint while leaving it
       wrong, at the cost of a containing block for descendants and blurry text on some platforms.

       THE BAR JUMPED VERTICALLY BY ~15px FOR ONE FRAME ON EVERY TAB SWITCH, and `position: fixed` is not the
       thing that was wrong — the viewport it is fixed to is what moved. A horizontal scrollbar appeared for a
       single frame, and a horizontal scrollbar shrinks the VISUAL viewport: `innerHeight` stays put while
       `visualViewport.height` drops by the scrollbar's height. `bottom: 0` resolves against the visual viewport,
       so the bar faithfully followed it down and back. Traced frame by frame at a 376px viewport: `innerHeight`
       707 throughout, `visualViewport.height` 707 → 692 → 707, bar gap 0 → 15 → 0.

       THE OVERFLOW WAS A PAIR OF INVISIBLE TOOLTIPS, not anything in this file or in the tab panels' geometry —
       `scrollWidth` 419 vs `clientWidth` 376, with the chart's "Chart display settings" and the profile menu's
       "Manage profiles" tooltips the only boxes past the edge. They are `opacity-0`, so they are still laid out,
       and the runtime clamp they used to carry was computed against a `hidden` (zero-width) panel while their tab
       was inactive — a stale offset on the frame that panel became visible. Fixed by deleting the clamp: Tooltip
       is positioned by Floating UI with `strategy: "fixed"`, so it is laid out against the viewport and cannot
       contribute to the document's scroll extent at all. See components/ui/Tooltip.jsx.

       Nothing here needs to change, and nothing here CAN fix it: a fixed element cannot opt out of the visual
       viewport. Do not reach for `transform-gpu` or a `dvh` calc — neither addresses a shrinking viewport. */
    <nav
      id="app-bottom-nav"
      aria-label="Primary"
      // `right-[…gutter]` (not padding) keeps the bar in register with the page when a modal hides the
      // scrollbar. The in-flow column gets that width back as a margin, but this box is fixed to the
      // viewport and does not see it. It has to be the RIGHT EDGE that moves: padding would inset only
      // the row inside while `bg-slate-100` kept painting to the viewport edge, so the bar still visibly
      // overhung the page. Moving the edge narrows the painted box itself. 0px at rest.
      className="fixed left-0 right-[var(--scroll-lock-gutter)] bottom-0 z-40 bg-slate-100 shadow-[0_-1px_3px_0_rgb(0_0_0/0.1),0_-1px_2px_1px_rgb(0_0_0/0.1)] pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      {/* FULL-WIDTH AND CENTRED. The row always spans the viewport; what bounds it on a wide screen is the PER-ITEM
          cap on the buttons below, not a cap here. `justify-center` is what that cap needs to be usable: once the
          items stop growing they no longer fill the row, and without it the leftover width would collect on one
          side and strand the group against the left edge.

          THE CAP MOVED OFF THIS CONTAINER, and the reason is the tab count. It was `max-w-[360px]` here, which
          fixed the whole ROW's width — so every tab added made all the tabs narrower (two at 180px, three at
          120px, four at 90px) until they were too small to read. Capping each ITEM instead makes the row's natural
          width `n × 180px`, so the bar GROWS with the tab count and stays centred, and adding a tab never shrinks
          the ones already there. This is the same instinct as the note below about not coupling to a content
          measure: the bar's width should follow what is in it, not a number chosen for a different reason.

          Below `xs` (470px) the items are uncapped and simply split the viewport — see the note on the button. At
          that width the row is the full viewport in both cases, so this container behaves identically either side
          of the breakpoint and needs no responsive variant of its own.

          NO HORIZONTAL PADDING, deliberately, AND THE CAP IS NOT A SUBSTITUTE FOR ONE. `px-3` here inset every
          item by 12px, which meant the active indicator — the top border on the button — stopped 12px short of
          the row's edge on the outer side and could not reach it. Bounding the ITEMS does not have that problem:
          each button still spans its own share of the row edge to edge, so the borders still abut into one
          unbroken band and every pixel of a button is tappable. Any breathing room the labels need belongs INSIDE
          each button, not around the row.

          Above `xs`, the empty tint either side of the capped group is bar, not dead target — the same as the
          space beside the header's brand mark. Only space INSIDE a button's own width would be dead. */}
      <div className="mx-auto flex w-full items-stretch justify-center">
        {NAV_ITEMS.map(({ id, label, icon: Icon, version, adminOnly }) => {
          const selected = activeTab === id;
          // Lit whether or not the Theory tab is active: opening the tab does not clear it. It is the aggregate
          // of the per-section dots and stays lit until every changed section has been scrolled to.
          const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
          return (
            /* `flex-1` — the items SHARE the bar's width equally rather than sizing to their labels. This is the
               one place the old segmented control's equal-columns behaviour was actually right: a bottom bar's
               targets should be the same size and span the full width, so there is no dead gap between them and
               no item is easier to hit than another. It is also what makes a third tab a non-event.

               `xs:max-w-[180px]` IS THE BAR'S ONLY WIDTH BOUND, and it is PER ITEM rather than on the row (see
               the container's note for why it moved). With `flex-1` the items grow equally until each hits 180px,
               at which point the row stops at `n × 180px` and `justify-center` centres it. So the bar widens as
               tabs are added instead of subdividing a fixed 360px, and no tab ever shrinks because another one
               was added.

               180px IS THE OLD 360px ROW AT TODAY'S TWO TABS, chosen so this change is a no-op at the current tab
               count and only shows up from the third tab on. It is also roughly a phone tab's width, which is the
               size these targets were tuned at.

               UNCAPPED BELOW `xs` (470px), where `flex-1` alone runs and the items split the viewport. A 180px
               cap would bind there on any phone wider than 360px and leave bare tint down each side, which is the
               opposite of what is wanted at the width where the bar is thumb-driven — targets should be as large
               as the screen allows. `xs` is the app's own smallest breakpoint (index.css, PillarGrid,
               ChartScores), so the bar changes shape on the same line everything else does.

               THE THREE-TAB CASE IS WHY THE CAP CANNOT BE MUCH LOWER: at 350px, the app's floor, three uncapped
               tabs are ~117px each and already tight for "Theory v4.1". Lowering 180px pushes the wide-screen row
               toward that same crampedness for no gain.

               `min-h-14` (56px) MATCHES THE HEADER'S OWN `min-h-14`, so the app's two pinned bars are the same
               weight of chrome top and bottom. It was `min-h-12` (48px) — already above the 44px touch-target
               floor, so this is not an accessibility change but a symmetry one: at 48px the bar read thin
               against a 56px header, which made the bottom of the page look like an afterthought rather than the
               other half of the same shell.

               THE PAINTED BAR IS 59px, NOT 56px, because the 3px `border-t` below sits outside this box's
               `min-height`. The header is 57px for the same reason (`min-h-14` + its own `border-b`). Matching
               the CONTENT rows rather than the outer edges is the right call: the borders are the boundary
               marks, not part of the bar, and both are the 12px-padded-control geometry the header's docblock
               describes.

               ANYTHING THAT RESERVES THIS BAR'S SPACE HAS TO MOVE WITH IT — the row height is repeated as
               `3.5rem` in HomePage's `main` padding and in the Toaster's bottom offset. See the note in
               Toaster.jsx: they agree by construction, not by measurement, so all three change together. */
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                // No `rounded-md`: these are full-height segments of a bar, not free-floating buttons, so a
                // corner radius would leave white notches where the active tint meets its neighbour.
                // THE TYPE SIZE IS INHERITED BY THE LABEL AND THE VERSION BOTH, which is the point — the version
                // span carries no size of its own precisely so the two stay one style. Change it here, not on the
                // label.
                //
                // `11 → sm:12 → md:13` IS THE APP'S TYPE LADDER, ONE RUNG UP: a 1px step at each of the same two
                // breakpoints every other scaling site uses. It is character-for-character CompetencyMatrix's own
                // `text-[11px] sm:text-[12px] md:text-[13px]` (see its term label) — the endpoints were arrived at
                // separately here, from the bar's own needs, and landed on a size pair the app already had.
                //
                // ONE RUNG UP FROM PillarCluster/ChartScores' `10 → 11 → 12`, because 10px is too small for this
                // particular text: those are captions and cells read at leisure inside content, whereas these are
                // the labels on the app's ONLY navigation, read at a glance and mostly on a phone — i.e. exactly
                // the width where the ladder would have made them smallest.
                //
                // THE `sm` RUNG IS THE POINT, and it was missing: this was `11 → md:13`, a single 2px jump. Every
                // other site steps at BOTH `sm` (640px) and `md` (768px), so between those two widths the page's
                // captions grew and these labels did not — the nav visibly fell behind its surroundings in the
                // band where they diverged, then over-corrected in one jump. Matching the app means matching the
                // BREAKPOINTS, not just the two endpoints. Do not drop `sm` again on the grounds that it is a
                // small step: being in step with the content is what it buys.
                "group relative flex min-h-14 flex-1 xs:max-w-[150px] cursor-pointer select-none flex-col items-center justify-center gap-1 text-[11px] sm:text-[12px] md:text-[13px] font-semibold",

                // A 3px BORDER ON EVERY ITEM, COLOURED ON ONLY ONE. This is what makes the rule span the whole
                // ROW while marking a single segment: each button owns the 3px directly above itself, the buttons
                // are adjacent, so the borders abut into one unbroken band across the row — dark over the active
                // segment, invisible over the rest. The band spans the ITEMS, not the viewport: above `xs` they
                // are capped and centred (see above), so it covers the centred group and the tint either side of
                // it carries no rule. Below `xs` the items fill the viewport, so the band does too.
                //
                // It was `border-t-2`. 3px is an arbitrary value because Tailwind's border scale jumps 2 → 4 with
                // nothing between, and 4px read as a slab rather than a marker at this bar's weight.
                //
                // THE TRANSPARENT BORDER IS THE POINT, not filler. A border on the active item alone would make
                // that item 3px taller than its neighbours, so the icons and labels would sit off each other and
                // the whole row would shift by 3px on every tab change. Giving the inactive items the same border
                // in `transparent` means all segments are always the same height and only the COLOUR changes —
                // nothing reflows.
                //
                // Drawn by the border rather than an absolutely-positioned child (which is what this was first):
                // a child had to be pulled to `-top-px` to reach the bar's edge and still fought the row's
                // padding for its last few px. A border IS the top edge, so there is no geometry to get right.
                "border-t-[3px]",

                // THE TINT IS A SECOND, NON-COLOUR SIGNAL. Colour alone (black vs slate-500) is too weak on its
                // own: at a glance, and for anyone who discriminates these greys poorly, two labels in different
                // darks do not say which one you are on. Filled-versus-unfilled survives both, and it reinforces
                // the rule above rather than repeating it.
                //
                // BOTH FILLS ARE READ AGAINST THE BAR, so both moved when it gained its tint. On a white bar they
                // were `bg-slate-100` (active) and `bg-slate-50` (hover); on `bg-slate-100` those ARE the bar, so
                // the hover would be a literal no-op and the active fill would disappear.
                //
                // THREE GAPS HAVE TO HOLD AT ONCE, which is what makes this fiddly to change: active vs BAR (or
                // the selected tab is invisible), hover vs BAR (or hovering does nothing), and active vs HOVER
                // (or hovering an inactive tab makes it look selected). Moving the bar forces both of these.
                //
                // THE ACTIVE FILL IS `slate-200`, ONE STEP OFF THE BAR — deliberately light. `slate-300` has now been
                // tried TWICE and rejected twice: it buys the hover a full rung to sit on, but the active tab then
                // reads as a PRESSED BUTTON rather than a passive "you are here" marker, which is the wrong idea
                // about what the mark is for. Do not reach for it a third time. The active state does not have to
                // carry the signal alone — it also gets a BLACK top border and black text, so a light fill is the
                // third of three cues.
                //
                // THAT PUTS ACTIVE ADJACENT TO THE BAR, so the hover between them is HALF A RUNG by arithmetic, not
                // by choice. slate-100 and slate-200 are consecutive; there is no named colour in the gap, so a
                // middleground has to be a fraction of a step. `slate-200/50` is that fraction expressed as what it
                // actually is: THE ACTIVE FILL AT HALF STRENGTH, so hover is literally halfway to selected and stays
                // halfway if the active value is ever retuned. An arbitrary hex (rgb(234 239 245), the same colour)
                // would be a third constant to keep in step by hand.
                //
                // THE GAPS ARE GENUINELY FAINT AND THAT IS THE CEILING, NOT AN OVERSIGHT. Bar to active is only 1.125
                // contrast to begin with, so splitting it lands ~1.055 on each side. Hover is transient and
                // POINTER-ONLY — it does not exist on touch, where this bar mostly lives — so it is the right state
                // to spend the subtlest signal on, while the selected state persists and must stay unambiguous. There
                // is no arrangement that makes both bold: widening the hover means darkening active, which is the
                // trade already refused above.
                //
                // WHAT MAKES THIS DIFFERENT FROM THE `slate-100/70` IT REPLACES — and the distinction is the whole
                // point, since both are alpha values over the same bar. That one was the BAR'S OWN colour at 70%:
                // slate-100 over slate-100 composites to slate-100 exactly, contrast 1.000, a literal no-op. It was
                // correct when the bar was white and silently died when the bar took the tint. This one is the
                // ACTIVE colour at 50%, which is a different colour from the background by construction — it cannot
                // collapse into the bar without slate-200 itself becoming slate-100.
                //
                // SO THE RULE IS NOT "NEVER ALPHA", IT IS "NEVER ALPHA OF THE BACKGROUND YOU SIT ON". An earlier
                // revision of this note concluded the fix was to go opaque; that overshot. Alpha of a DIFFERENT rung
                // is what makes a half-step expressible at all here, and it is self-maintaining in the one direction
                // that matters — it tracks the state it interpolates toward, not the surface it has to differ from.
                //
                // `transition-colors` covers the border, the tint and the text together, so the whole segment
                // resolves as one change on tab switch.
                "transition-colors",

                // THE ACTIVE MARK IS TRUE `black`, NOT `slate-900`. Everything else in the app's greys is on the
                // slate ramp, and slate-900 (#0f172a) carries that ramp's blue cast — against the bar's own
                // slate-100 the two sit on one hue, so the active tab was the darkest thing in a family rather
                // than a mark set apart from it. Black has no cast, so it reads as ink on the chrome.
                //
                // BOTH THE BORDER AND THE TEXT, together, because they are one mark: a black rule over slate-900
                // words (or the reverse) shows up as two slightly different darks stacked, which is more visible
                // than either value is wrong. The icon takes it too — see the Icon's own `text-black` below, which
                // has to be changed with these.
                //
                // The INACTIVE side stays on the slate ramp deliberately: it is the unselected majority and should
                // recede into the chrome it sits on, which is exactly what sharing the bar's hue does. Black is
                // reserved for the one segment being marked.
                selected ? "border-black bg-slate-200 text-black" : "border-transparent text-slate-500 hover:bg-slate-200/50",
              )}
            >
              {/* THE UNSEEN DOT BADGES THE ICON, not the version text. It rode on `v4.1` as a superscript when this
                  was a segmented control in the header, where the label was the only thing big enough to hang it
                  off. On a bottom bar the icon is the anchor — a notification badge on an icon is the convention
                  every OS uses, so it needs no learning, and it no longer depends on the Theory item being the one
                  tab that happens to carry a version string.

                  `relative` on the wrapper rather than on the button: anchoring to the button would put the badge
                  at the corner of a 56px-tall full-width segment, which reads as decorating the bar, not the tab.
                  The wrapper is exactly the icon's box, so `-top-0.5 -right-1` lands the dot on the glyph's own
                  top-right the way an app-icon badge sits.

                  `size-2` (8px) rather than the 6px it was inline: it is no longer next to 10px text that set its
                  scale, and against the icon 6px read as a smudge. It stays 8px against the 24px glyph — a badge
                  scaling with its icon would just make it a bigger blob; 8px is a dot at both sizes.

                  ITS OFFSETS ARE NOT SCALE-FREE, THOUGH, and they moved with the glyph: `-right-1.5` was set when
                  the icon was 20px, and on a 24px box the same value sits 2px further from the corner, i.e. further
                  in over the strokes. `-right-1` puts it back on the glyph's own top-right where an app-icon badge
                  sits. Re-judge these two numbers whenever `size-*` on the Icon changes. */}
              <span className="relative shrink-0">
                {/* `size-6` (24px), up from `size-5`. The icon is the item's primary signal — the label under it
                    is a 12px caption, so the glyph carries recognition at a glance and can afford the size. The
                    row is 56px with `gap-0.5`, which leaves 24 + 2 + ~12 = ~38px of content in it: still comfortably
                    inside the row with room either side, so nothing had to move to make space.

                    THE UNSEEN DOT'S OFFSETS ARE MEASURED AGAINST THIS BOX and were re-judged for 24px — see the
                    note below. A badge pinned to a glyph's corner does not survive the glyph changing size. */}
                {/* `text-black` when selected, matching the border and label above rather than the `slate-900` this
                    was — the three are one mark and have to move together.

                    NO HOVER VALUE, HERE OR ON THE BUTTON — the glyph is slate-400 at rest and stays slate-400 while
                    hovered. Hover is carried by the segment's BACKGROUND alone (see the fill note above). Neither the
                    icon nor the label shifts colour.

                    IT CARRIED `group-hover:text-slate-600` AND THAT WENT FIRST, because a rung of the slate ramp is
                    not a fixed amount of visual weight — it trades against how much ink carries it. slate-600 was
                    nominally LIGHTER than the label's hover slate-700, matching the one-rung offset the resting state
                    keeps (slate-400 icon vs slate-500 label), but 24px of solid 2px strokes reads heavier than 11px
                    semibold text, so the glyph looked DARKER than the label it was supposed to sit behind. Worse at
                    24px than at the 20px it was set for.

                    THE LABEL'S `hover:text-slate-700` THEN WENT TOO, rather than being matched. Aligning the two on
                    one hover colour was the intermediate fix and it worked, but it left the segment doing two things
                    at once: lifting its fill AND darkening its contents. One signal is enough for a transient,
                    pointer-only state, and the fill is the one that reads as "this whole target is live" rather than
                    as the text itself changing meaning.

                    THE RESTING OFFSET SURVIVES ALL OF THIS. slate-400 against the label's slate-500 is unchanged: at
                    rest the icon is decoration on an unselected tab and should sit back from its label. That was never
                    the thing that looked wrong.

                    SO THERE IS NOW EXACTLY ONE COLOUR PER STATE PER ELEMENT, and no `group-hover` anywhere in this
                    button. Nothing here needs re-judging the next time `size-*` changes, which is what the deleted
                    values could not promise. */}
                <Icon className={cn("size-6 shrink-0", selected ? "text-black" : "text-slate-400")} aria-hidden />
                {showUnseenDot ? (
                  // NO RING. The dot used to carry `ring-2` in the segment's own background colour, so the band
                  // read as a gap separating the red from the icon strokes underneath. Nothing tied that colour
                  // to the background it was copied from, and every past value (`ring-white`, then `ring-slate-50`,
                  // then `ring-slate-200`) was correct for exactly one bar colour and showed as a halo after the
                  // next change. The dot sits at the glyph's top-right corner, clear of its strokes, so it reads
                  // on its own without one.
                  //
                  // If a ring comes back it needs BOTH a width and a colour: `ring-2` alone falls through to
                  // Tailwind's `--color-ring` (a mid grey, see src/index.css) and draws exactly the halo above.
                  <UnseenDot label="New framework updates" className={cn("absolute top-0 -right-2 size-2")} />
                ) : null}
                {/* ON THE WRENCH'S TOP-RIGHT, CLEAR OF THE GLYPH — the app-icon badge position, and the same
                    corner and the same relationship the unseen dot has to its own icon.

                    The wrapper span is exactly the 24px glyph's box (it is what the dot is measured against
                    too), so these offsets are read against the GLYPH and not against the 56px segment around
                    it. That is the whole reason the badge lives inside this span rather than on the button:
                    anchored to the button it would sit at the corner of a full-width bar segment and read as
                    decorating the bar, not the tab.

                    `-top-1 -right-4` CLEARS THE CORNER RATHER THAN SITTING ON IT, AND THE HORIZONTAL VALUE IS THE
                    ONE THAT NEEDED EYES ON IT. Several earlier values each missed differently: `-bottom-1
                    -right-1.5` was on the wrong corner entirely; `-bottom-0.5 -right-0.5` tucked into the corner
                    and overlapped the strokes; `-top-1.5 -right-1.5` reached the right corner but still sat over
                    the glyph, because the wrench's HEAD is its top-right mass — the shaft runs down-left from it
                    — so a badge a few px out was landing on the head rather than beside it. `-right-4` (16px) is
                    what actually clears the head.

                    THE NUMBERS ARE NOT SYMMETRIC AND SHOULD NOT BE MADE SO. Clearing a glyph means clearing the
                    ink that is actually at that corner, and lucide's icons do not fill their box evenly — the
                    vertical offset stays much smaller than the horizontal one because there is little wrench near
                    the top edge and a lot near the right. A badge that clears the shape needs no ring to separate
                    it, and stays legible if the glyph beneath it is ever swapped for a busier one.

                    THE OFFSETS ARE FIXED px AND THE DISC'S SIZE NOW LIVES IN AdminLockBadge, so the two can move
                    independently — which they have: these were set while the badge was 14px and it is 12px now.
                    A smaller disc at the same offset sits further out relative to its own width, so re-judge
                    both numbers if the component's size changes rather than assuming they scale.

                    IT SHARES THE DOT'S CORNER, WHICH IS A REAL CONSTRAINT AND NOT AN OVERSIGHT. The dot is
                    `top-0 -right-2` on this same box, so a tab carrying both marks would stack them. None does:
                    the dot is Theory's (framework updates) and the lock is Admin's, and the Admin tab has no
                    changelog to be unread. Top-right is the correct position for BOTH — it is where a badge goes
                    — so the resolution if that ever changes is to displace one along the top edge, not to bump
                    this one to a corner where it reads as a second icon.

                    BOTH NUMBERS ARE MEASURED AGAINST `size-6` AND DO NOT SURVIVE IT CHANGING, the same caveat
                    the dot's note carries: an offset that clears a 24px box sits somewhere else on a 20px one.

                    NO RING, AND NO FILL MATCHED TO THIS BAR — inherited from AdminLockBadge, see its note. It
                    matters here specifically because this tab's background is the one that MOVES: `bg-slate-200`
                    when selected, the bar's `bg-slate-100` when not. Any value copied from either would be right
                    in one state and wrong in the other, so the badge stays a flat slate disc in both. */}
                {adminOnly ? <AdminLockBadge className="-top-1 -right-4" /> : null}
              </span>
              {/* `items-baseline`, NOT `items-start`, which is what this was. Top-aligning two inline spans lines
                  up their LINE BOXES, and a line box's top is only where the text starts if both spans are the
                  same type size — the version was 10px against an 11px label, so flushing the tops sat the
                  version's glyphs a fraction high and its baseline visibly above the label's. Baseline alignment
                  is the relationship that actually reads as "aligned" for text set side by side, and it stays
                  correct if either size is ever changed again. */}
              <span className="flex items-baseline leading-none">
                {label}
                {version ? (
                  // Inline with the label: the version qualifies "Theory" rather than standing on its own.
                  //
                  // NO TYPE SIZE AND NO WEIGHT OF ITS OWN — it inherits the button's `font-semibold` and its
                  // responsive size, so it is the same style as the label beside it and rides the app's type ladder
                  // across breakpoints without repeating any of its steps here. It was `text-[10px] font-semibold`:
                  // the weight was already a restatement of the inherited value, and the fixed 10px was the whole
                  // reason the two runs did not sit on one line. A version string one step smaller than the word it
                  // qualifies reads as a footnote bolted on rather than part of the label.
                  //
                  // `text-slate-500` in BOTH states, not a ternary on `selected`. The old segmented control needed
                  // two values because the active tab was a dark pill (`text-white/70` on it, slate otherwise);
                  // here the active tab is a light tint, so one muted grey is legible against both and a
                  // conditional would be a decision that makes no difference. It is ALSO now the only thing
                  // distinguishing the version from the label, since the size and weight no longer do.
                  <span className="ml-1 leading-none text-slate-500">{version}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
