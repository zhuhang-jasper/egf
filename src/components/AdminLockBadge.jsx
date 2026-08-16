import { Lock } from "lucide-react";

import { cn } from "@/utils";

/**
 * Marks a control as absent from the public build. It means "only you can see this", not "click to unlock".
 *
 * THE ANCHOR IS THE CALLER'S JOB: this is an absolutely-positioned box and nothing else, so corner-badging
 * callers must establish `relative` on the badged element or it pins to whatever ancestor has it. Passing
 * `static` switches it inline, which is what the display menu's rows want.
 *
 * One colour in every state, with no value copied from any surface: the nav tab's fill changes with
 * selection, so a matched tint would be wrong in one state. No ring, for the reason UnseenDot has none.
 */
export function AdminLockBadge({ className, label = "Admin only" }) {
  return (
    <span
      // `role="img"` + `aria-label` rather than `aria-hidden`: the badge is the only thing saying this control
      // is not in the public build. Callers that already spell "Admin only" into their own accessible name pass
      // `label={undefined}` instead of repeating it.
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        // The disc size lives here rather than in each caller, where it immediately drifted to two values. It
        // is derived from the 8px glyph below rather than chosen independently: 2px of fill each side is the
        // least that reads as a disc-with-a-mark. The two move together.
        "pointer-events-none absolute z-10 grid size-3 place-items-center rounded-full bg-slate-500 text-white ring-0 print:hidden",
        // Both children land in the same 1x1 grid cell, so the disc and the glyph are rasterized off one
        // origin. With flex the 12px box and the 8px child rounded to the device grid separately, and on a
        // fractional anchor (the nav's `flex-1` buttons never land on whole pixels) they rounded opposite
        // ways, so the lock sat 1px off-centre and the direction flipped on resize.
        "[&>*]:col-start-1 [&>*]:row-start-1",
        className,
      )}
    >
      {/* 8px is this component's fixed quantity and the floor for a padlock that still reads as one: below it
          the gap between body and shackle goes sub-pixel and the glyph collapses into a blob. It matches
          UnseenDot's size, keeping the app's two icon-corner badges the same class of mark.

          `strokeWidth={2.5}` is what makes 8px work. Lucide's default 2 renders soft at this scale, and 3 in
          white blooms until the shackle's gap closes, since light strokes on dark read heavier than the same
          nominal width dark on light. Re-judge it alongside the fill colour, not on its own.

          Nudged up a hair because Lucide centres the lock's *bounding box*, not its mass: the shackle above
          y=11 is open air and the body below is solid, so a geometrically centred padlock reads low. This is
          the optical correction, and it is separate from the rasterization fix above. */}
      <Lock className="size-2 shrink-0 -translate-y-[0.5px]" strokeWidth={2.5} aria-hidden />
    </span>
  );
}
