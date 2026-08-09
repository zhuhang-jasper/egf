import { Lock } from "lucide-react";

import { cn } from "@/utils";

/**
 * The marker on every control that only exists because the dev unlock is on (see constants/features.js).
 *
 * IT MEANS "ONLY YOU CAN SEE THIS", NOT "CLICK TO UNLOCK". Everything it badges is already rendered
 * conditionally on IS_ADMIN, so by the time this is on screen the lock is open — a public reader never sees
 * either the control or the badge. What it buys is knowing, at a glance, which of the controls in front of
 * you are absent from the build a colleague is looking at. That matters most when a chart is being set up to
 * share: the display menu mixes four admin-only toggles in among four public ones, and without the mark
 * there is nothing to say which of them the recipient could have reached.
 *
 * A CORNER BADGE BY DEFAULT, because it has to work on shapes that share nothing: a 24px icon in the bottom
 * nav and a labelled pill in the theory toolbar. Pinned to a corner it is the same relationship on both —
 * attached to the thing, outside its content — which is the convention the unseen dot already uses on the nav
 * icon (see UnseenDot) and so needs no learning.
 *
 * SO THE ANCHOR IS THE CALLER'S JOB. This renders an absolutely-positioned box and nothing else; the caller
 * supplies the offsets through `className`, because where a corner IS depends on the box being badged — a
 * square glyph's corner is a right angle, a pill's curves away from it, and the ink inside an icon's box is
 * not evenly distributed (see the nav's note, where the two offsets are deliberately asymmetric). Every
 * corner-badging caller must establish a positioning context (`relative`) on the element being badged, or
 * this pins itself to whatever ancestor happens to have one.
 *
 * IT ALSO GOES INLINE, VIA `static` IN THE CALLER'S className, and the display menu is the site that wants
 * that (see ChartSection's DisplayCheckbox). The corner treatment is right for a control read on its own and
 * wrong for one row in a list of near-identical rows: pinned to each checkbox, the badges line up into a
 * column of padlocks down the menu's left edge, which has to be read against the rows to be attributed to
 * any of them. Trailing the label text, the mark is in the same reading pass as the words it qualifies.
 * `static` is the switch, and an inline caller passes no offsets at all.
 *
 * A SOLID DISC WITH THE GLYPH KNOCKED OUT WHITE, not an outline lock in the app's greys. At this size a lock
 * is a body, a shackle and the gap between them, so a dark glyph on a light disc has too little ink to survive
 * being read at a glance on top of another control — it greys out into a smudge, the same failure that sets
 * `strokeWidth` below. Inverting it puts the CONTRAST in the fill, where there is a whole disc of it, and
 * leaves the glyph as white cut out of that.
 *
 * `slate-500` IS THE FILL, tuned down from the `black` this carried first. Black made the badge the heaviest
 * mark on the screen — heavier than the nav's own active-tab indicator, which is the one thing in this app
 * that gets true black (see AppBottomNav). That inverted the hierarchy: a marker saying "only you can see
 * this" was outweighing the marker saying "you are here". slate-500 keeps the knocked-out glyph legible while
 * sitting the badge back into the chrome, and it is the same rung as the nav's own inactive label text, so it
 * reads as belonging to the app's greys rather than shouting over them.
 *
 * NO RING (`ring-0`). It had `ring-2 ring-white` while the fill was black, to keep a hard edge where the disc
 * overhangs an icon's strokes or a pill's border. At slate-500 the disc no longer needs rescuing from what it
 * crosses, and the ring was doing what the unseen dot's ring was removed for doing (see UnseenDot): reading as
 * a halo, a light band that belongs to no surface. If one ever comes back it needs BOTH a width and a colour —
 * `ring-2` alone falls through to Tailwind's `--color-ring` mid grey (see src/index.css), which is the halo.
 *
 * ONE COLOUR IN EVERY STATE — not a ternary on selected/hover. It is a passive marker about who can see the
 * control, so it must not change with the control's state or it starts looking like part of that control's
 * own signal. That is also why no surface tint is matched anywhere: the nav tab's fill alone changes between
 * `bg-slate-200` and `bg-slate-100` with selection, so any value copied from a background would be right in
 * one state and wrong in the other.
 *
 * `print:hidden`: the dev unlock is a property of this device's localStorage, not of the framework. On paper
 * it is an unexplained padlock next to a heading.
 */
export function AdminLockBadge({ className, label = "Admin only" }) {
  return (
    <span
      // `role="img"` + `aria-label` rather than `aria-hidden`: the badge is the only thing saying this
      // control is not in the public build, and that fact is not recoverable from the label beside it.
      // Callers that already spell "Admin only" into their own accessible name pass `label={undefined}`
      // instead of repeating it.
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        // THE DISC LIVES HERE RATHER THAN IN EVERY CALLER. It was passed in per site and immediately drifted:
        // 14px on the nav and the Print pill against 12px in the display menu, which read as two different
        // badges rather than one mark used three times. Owning it here makes them one size by construction. A
        // caller can still override it — `cn` lets a later `size-*` win — but there is no longer a reason to,
        // and doing so reintroduces exactly the drift this fixes.
        //
        // `size-3` (12px) IS DERIVED FROM THE GLYPH, NOT CHOSEN INDEPENDENTLY. The 8px lock below is the fixed
        // quantity (see its note); the disc is whatever leaves a visible ring of fill around it, and 2px on
        // each side is the least that reads as a disc-with-a-mark rather than a lock crammed into a circle.
        // So these two values move TOGETHER: growing the glyph without growing the disc closes that ring.
        "pointer-events-none absolute z-10 flex size-3 items-center justify-center rounded-full bg-slate-500 text-white ring-0 print:hidden",
        className,
      )}
    >
      {/* `size-2` (8px) IS THE FIXED QUANTITY OF THIS COMPONENT, and the disc above is sized from it rather than
          the other way round. 8px is the floor for a padlock that still reads as one: it is a body, a shackle,
          and the gap between them, so below this the gap goes sub-pixel and the glyph collapses into a blob —
          which is what happened at the 6px it briefly carried when the disc was 8px.

          IT IS ALSO THE UNSEEN DOT'S SIZE (see UnseenDot), and that coincidence is worth keeping: the two are
          the app's only icon-corner badges, so the marks read as the same class of thing even though one is a
          solid circle and this is a glyph on a disc. The difference is that a dot survives 8px trivially and a
          lock only just does.

          `strokeWidth={2.5}` IS WHAT MAKES 8px WORK, and it has held through every size and colour change here.
          Lucide's default 2 renders soft at this scale; 3 in WHITE blooms outward on a dark fill until the
          shackle's gap closes, because light strokes on dark read heavier than the same nominal width dark on
          light. Re-judge it alongside the fill colour, not on its own. */}
      <Lock className="size-2 shrink-0" strokeWidth={2.5} aria-hidden />
    </span>
  );
}
