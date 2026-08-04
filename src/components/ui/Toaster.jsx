import { AlertCircle, Check, X } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";

const VARIANT_META = {
  default: {
    icon: null,
    containerClass: "border-border bg-card text-card-foreground",
    dismissClass: "text-muted-foreground hover:text-foreground",
  },
  dark: {
    icon: null,
    containerClass: "border-transparent bg-slate-900 text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
  success: {
    icon: Check,
    containerClass: "border-transparent bg-emerald-600 text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
  error: {
    icon: AlertCircle,
    containerClass: "border-transparent bg-destructive text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
};

// Dismiss-button / countdown-ring geometry. The ring is drawn in its own SVG user space (a 20-unit
// box) and scaled by the button's Tailwind size, so the stroke stays crisp at any rendered size.
const RING_BOX = "h-5 w-5";
// Radius leaves room for half the stroke width inside the 20-unit box, so the ring never clips.
const RING_RADIUS = 8.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The thin arc wrapping a toast's dismiss "X", unwinding clockwise from 12 o'clock over `duration`
 * ms to show how long is left before the toast auto-dismisses. Purely decorative — the timer itself
 * lives in the store — so remount it (via a changing React `key`) whenever the toast's countdown is
 * re-armed. Under `prefers-reduced-motion` the animation is off and the ring simply sits full,
 * acting as a static border on the button.
 *
 * The dash values are pushed through CSS custom properties as `px` strings, NOT bare numbers: the
 * keyframes feed them to `stroke-dashoffset` via `calc()`, and an unitless custom property makes
 * that calc invalid, which silently drops the whole animation.
 */
function CountdownRing({ duration }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 -rotate-90"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      style={{
        "--toast-ring-circumference": `${RING_CIRCUMFERENCE}px`,
        "--toast-ring-duration": `${duration}ms`,
      }}
    >
      <circle cx="10" cy="10" r={RING_RADIUS} stroke="currentColor" strokeWidth="2" className="opacity-25" />
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={RING_CIRCUMFERENCE}
        className="toast-ring-track"
      />
    </svg>
  );
}

/**
 * App-wide toast host. Mount once near the app root; it subscribes to the store's `toasts`
 * stack and renders a bottom-centered pile of transient notices (newest nearest the edge). Toasts
 * are added via the store's `showToast` action and auto-dismiss on a timer (see useAppStore).
 */
export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      // TOASTS SIT ABOVE THE BOTTOM NAV, NOT OVER IT. The bar is `fixed` at `bottom: 0` (see AppBottomNav)
      // and this stack is `fixed` too, so anchoring to the viewport's bottom edge put the newest toast --
      // the one that just appeared -- directly on top of the navigation. `z-[100]` means it wins that
      // overlap rather than hiding behind it, which is the worse of the two failures: transient feedback
      // covering the app's only navigation for the length of its timer.
      //
      // THE OFFSET REPEATS THE BAR'S OWN HEIGHT EXPRESSION rather than measuring it. `3.5rem` is the row's
      // `min-h-14` and the `env()` term is the bar's `pb-[env(safe-area-inset-bottom)]`, so the two agree
      // by construction -- the same pairing HomePage's `main` uses to reserve the bar's space. Measuring
      // the element instead (as getPopoverViewportBounds does for popovers) would need a resize observer
      // for a value that is static; the popovers need it because they clamp to a live rect, this does not.
      // If the bar's height changes, these three sites change together.
      //
      // `4.5rem` IS THAT `3.5rem` PLUS THE 1rem GAP — the two terms are summed into one literal because
      // `bottom` takes a single length, so the row height is not visible as its own term here. When the bar's
      // row moves, this number moves by the same amount, not to the new row height.
      //
      // `+1rem` is the breathing room the stack had before, now measured from the bar's top edge instead of
      // the viewport's. The old `max(1rem, env(...))` collapses into the sum: the inset is already carried
      // by the bar's own padding underneath, so adding it again here would double it on a notched iPhone.
      //
      // `print:hidden` — a toast is transient feedback about something the user just did. It is only in
      // the DOM while it is on screen, so printing during that window would otherwise stamp it onto the
      // page, `fixed` over whatever is underneath.
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col-reverse items-center gap-2 px-4 print:hidden"
    >
      {toasts.map((t) => {
        const meta = VARIANT_META[t.variant] ?? VARIANT_META.default;
        const Icon = meta.icon;
        return (
          <output
            key={t.id}
            className={cn(
              "toast-enter pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-md",
              meta.containerClass,
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span className="min-w-0">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className={cn("ml-1 shrink-0 select-none rounded-sm px-1.5 py-0.5 text-sm font-semibold underline-offset-2 hover:underline", meta.dismissClass)}
                onClick={() => {
                  t.action.onAction();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              className={cn("relative ml-1 grid shrink-0 place-items-center rounded-full", RING_BOX, meta.dismissClass)}
              onClick={() => dismissToast(t.id)}
            >
              {t.duration > 0 ? <CountdownRing key={t.cycle} duration={t.duration} /> : null}
              <X className="h-3 w-3" />
            </button>
          </output>
        );
      })}
    </div>
  );
}
