import { FileText, Radar } from "lucide-react";

import { UnseenDot } from "@/components/UnseenDot";

import { FRAMEWORK_VERSION } from "@/constants";
import { cn } from "@/utils";

/**
 * The app's primary navigation. Same two destinations the header's segmented control used to hold; `version`
 * still derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot (see
 * useTheoryUpdates) cannot disagree.
 */
const NAV_ITEMS = [
  { id: "tool", label: "Tool", icon: Radar },
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
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
 * THE PADDING IS ON THE BAR, NOT THE ROW, so the bar's white background and its shadow extend into the inset while
 * the row of `min-h-12` touch targets sits entirely above it. Putting it on the row instead would pad the targets
 * from below — the bar would be the right height, but the bottom 34px of it would be dead space that looks tappable.
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

       A shadow rather than the `border-t` this had first: a hairline is a seam between two flat areas, which is
       what made the bar look pasted onto the footer above it. A shadow lifts it off the content instead, which is
       the relationship that is actually true — this floats above a scrolling page.

       NO `transform-gpu` HERE, AND THE FIX FOR THE TAB-SWITCH JUMP IS NOT IN THIS FILE. This bar visibly jumped on
       every tab switch, and a compositor-layer promotion here looked like the fix but was not: the cause was that
       the VIEWPORT ITSELF changed width. The two tabs use different content measures, so switching changed the
       document height enough to add or drop the vertical scrollbar, and `inset-x-0` faithfully re-centred to the
       new width. `scrollbar-gutter: stable` on `body` (see index.css) reserves that gutter permanently so the
       width is constant. Promoting this to its own layer only made the symptom cheaper to repaint while leaving it
       wrong, at the cost of a containing block for descendants and blurry text on some platforms. */
    <nav
      id="app-bottom-nav"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 bg-white shadow-[0_-1px_3px_0_rgb(0_0_0/0.1),0_-1px_2px_1px_rgb(0_0_0/0.1)] pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      {/* Capped to the same measure as the Tool tab's content and centred, so on a wide screen the two items sit
          under the content they navigate rather than stranded at the viewport's far corners.

          NO HORIZONTAL PADDING, deliberately. `px-3` here inset every item by 12px, which meant the active
          indicator — `inset-x-0` on the button — stopped 12px short of the bar's edge on the outer side and
          could not reach it. The items are full-height, full-width targets on a bar; insetting them leaves dead
          strips at both ends that look like part of the button but do not activate it. Any breathing room the
          labels need belongs INSIDE each button, not around the row. */}
      <div className="mx-auto flex w-full max-w-[550px] items-stretch">
        {NAV_ITEMS.map(({ id, label, icon: Icon, version }) => {
          const selected = activeTab === id;
          // Lit whether or not the Theory tab is active: opening the tab does not clear it. It is the aggregate
          // of the per-section dots and stays lit until every changed section has been scrolled to.
          const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
          return (
            /* `flex-1` — the items SHARE the bar's width equally rather than sizing to their labels. This is the
               one place the old segmented control's equal-columns behaviour was actually right: a bottom bar's
               targets should be the same size and span the full width, so there is no dead gap between them and
               no item is easier to hit than another. It is also what makes a third tab a non-event.

               `min-h-12` (48px) is the touch-target floor, well above the header row's 32px — this is a thumb
               target now, not a pointer one. */
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                // No `rounded-md`: these are full-height segments of a bar, not free-floating buttons, so a
                // corner radius would leave white notches where the active tint meets its neighbour.
                "group relative flex min-h-12 flex-1 cursor-pointer select-none flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",

                // `border-t-2` ON EVERY ITEM, COLOURED ON ONLY ONE. This is what makes the rule span the whole
                // bar while marking a single segment: each button owns the 2px directly above itself, the buttons
                // are adjacent, so the borders abut into one unbroken band across the full width — dark over the
                // active segment, invisible over the rest.
                //
                // THE TRANSPARENT BORDER IS THE POINT, not filler. A border on the active item alone would make
                // that item 2px taller than its neighbours, so the icons and labels would sit 1px off each other
                // and the whole row would shift by 2px on every tab change. Giving the inactive items the same
                // border in `transparent` means all segments are always the same height and only the COLOUR
                // changes — nothing reflows.
                //
                // Drawn by the border rather than an absolutely-positioned child (which is what this was first):
                // a child had to be pulled to `-top-px` to reach the bar's edge and still fought the row's
                // padding for its last 2px. A border IS the top edge, so there is no geometry to get right.
                "border-t-2",

                // THE TINT IS A SECOND, NON-COLOUR SIGNAL. Colour alone (slate-900 vs slate-500) is too weak on
                // its own: at a glance, and for anyone who discriminates these greys poorly, two similar labels in
                // slightly different greys do not say which one you are on. Filled-versus-unfilled survives both,
                // and it reinforces the rule above rather than repeating it.
                //
                // `transition-colors` covers the border, the tint and the text together, so the whole segment
                // resolves as one change on tab switch.
                "transition-colors",
                selected
                  ? "border-slate-900 bg-slate-100 text-slate-900"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
            >
              {/* THE UNSEEN DOT BADGES THE ICON, not the version text. It rode on `v4.1` as a superscript when this
                  was a segmented control in the header, where the label was the only thing big enough to hang it
                  off. On a bottom bar the icon is the anchor — a notification badge on an icon is the convention
                  every OS uses, so it needs no learning, and it no longer depends on the Theory item being the one
                  tab that happens to carry a version string.

                  `relative` on the wrapper rather than on the button: anchoring to the button would put the badge
                  at the corner of a 48px-tall full-width segment, which reads as decorating the bar, not the tab.
                  The wrapper is exactly the icon's box, so `-top-0.5 -right-1` lands the dot on the glyph's own
                  top-right the way an app-icon badge sits.

                  `size-2` (8px) rather than the 6px it was inline: it is no longer next to 10px text that set its
                  scale, and against a 20px icon 6px read as a smudge. */}
              <span className="relative shrink-0">
                <Icon className={cn("size-5 shrink-0", selected ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")} aria-hidden />
                {showUnseenDot ? (
                  // `ring-2` separates the dot from the glyph it overlaps — without it the red sits directly on the
                  // icon's strokes and the two read as one shape.
                  //
                  // THE RING COLOUR TRACKS THE SEGMENT'S BACKGROUND so it reads as a GAP rather than an outline: the
                  // active tab is tinted `bg-slate-100`, the others are the bar's white, and a fixed `ring-white`
                  // would show as a visible halo on the tinted one.
                  <UnseenDot
                    label="New framework updates"
                    className={cn("absolute -top-0.5 -right-1.5 size-2 ring-2", selected ? "ring-slate-100" : "ring-white")}
                  />
                ) : null}
              </span>
              <span className="flex items-start leading-none">
                {label}
                {version ? (
                  // Inline with the label: the version qualifies "Theory" rather than standing on its own.
                  //
                  // `text-slate-500` in BOTH states, not a ternary on `selected`. The old segmented control needed
                  // two values because the active tab was a dark pill (`text-white/70` on it, slate otherwise);
                  // here the active tab is a light tint, so one muted grey is legible against both and a
                  // conditional would be a decision that makes no difference.
                  <span className="ml-1 text-[10px] font-semibold leading-none text-slate-500">{version}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
