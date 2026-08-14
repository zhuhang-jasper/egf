import { useEffect, useRef } from "react";

import { AlertCircle, Check, X } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { LAYER } from "@/constants";
import { cn } from "@/utils";

// A neutral toast is dark: the old white card sat on a white form and read as part of the page
// rather than as a notice. Nothing distinguished it as a message. `dark` stays as an alias so the
// call sites that ask for it by name keep working — it is the same thing as the default.
const NEUTRAL_VARIANT = {
  icon: null,
  containerClass: "border-transparent bg-slate-900 text-white",
  dismissClass: "text-white/70 hover:text-white",
};

const VARIANT_META = {
  default: NEUTRAL_VARIANT,
  dark: NEUTRAL_VARIANT,
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
 * `armedAt` IS WHAT KEEPS THE ARC HONEST. A CSS animation starts at its element's first paint, while
 * the store's dismiss timer started back when `showToast` was called; anything that delays the commit
 * in between (a producing handler that blocks the main thread, such as the chart export rasterizing a
 * high-res canvas) is time the ring would otherwise still have to run after the toast is already gone.
 * A NEGATIVE `animation-delay` of the elapsed span seeks the animation to where it should already be,
 * so both end together however late the paint lands.
 *
 * A page SUSPENSION is the other way the two clocks part, and it is not this compensation's to absorb —
 * seeking would just show an already-empty ring on a toast about to vanish. `restartToastTimers` gives
 * the whole window back instead, and bumps `cycle` to remount this ring onto it.
 *
 * The elapsed span is read in a rAF callback rather than during render — see the note at the measurement
 * for why that specific moment. Not the render body in any case: that charges the ring for React work
 * which has not happened yet, and double-counts under StrictMode's re-render.
 *
 * The dash values are pushed through CSS custom properties as `px` strings, NOT bare numbers: the
 * keyframes feed them to `stroke-dashoffset` via `calc()`, and an unitless custom property makes
 * that calc invalid, which silently drops the whole animation.
 */
function CountdownRing({ duration, armedAt }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!(armedAt > 0)) {
      return undefined;
    }
    // MEASURED IN A rAF CALLBACK, not in the effect body: a CSS animation starts at the frame its
    // element is PAINTED in, and effects (layout or otherwise) run before that paint. Reading the clock
    // in the effect therefore stops short of the animation's real start and leaves the gap between
    // commit and paint uncounted — which on mobile Safari, right after the export's canvas work, is
    // where most of the stall actually is. The rAF callback runs in the painting frame itself.
    const id = requestAnimationFrame(() => {
      const el = svgRef.current;
      if (!el) {
        return;
      }
      // Clamped to the duration so a paint delayed past the whole window leaves the ring empty rather
      // than seeking past the end, and to <= 0 so it can only ever pull the animation forward.
      const elapsed = Math.min(Math.max(performance.now() - armedAt, 0), duration);
      el.style.setProperty("--toast-ring-delay", `${-elapsed}ms`);
    });
    return () => cancelAnimationFrame(id);
  }, [duration, armedAt]);

  return (
    <svg
      ref={svgRef}
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
  const restartToastTimers = useAppStore((s) => s.restartToastTimers);

  // GIVE A TOAST ITS WINDOW BACK WHEN THE PAGE RETURNS FROM THE BACKGROUND. Timers keep running while
  // the page is suspended but nothing paints, so a notice raised just before a native sheet took over
  // (iOS share/save, a file picker) would surface with its window already spent — visibly flashing, and
  // dropping any Undo before it could be tapped. `restartToastTimers` re-arms from now instead.
  //
  // `pageshow` alongside `visibilitychange` because iOS does not reliably deliver the latter on restore
  // — the same pairing, for the same reason, as the resume repaint in hooks/useChartFrameFit.js.
  //
  // Mounted unconditionally, ABOVE the empty-stack early return below: an effect cannot live behind a
  // conditional return, and with nothing on screen the handler is a no-op anyway.
  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === "visible") {
        restartToastTimers();
      }
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [restartToastTimers]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      // Sits ABOVE the bottom nav. `4.5rem` is the bar's `3.5rem` row plus a 1rem gap, summed because
      // `bottom` takes one length, so this moves by the bar's DELTA rather than to its new height. See
      // docs/DECISIONS.md#fixed-element-offsets-agree-by-construction.
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col-reverse items-center gap-2 px-4 print:hidden",
        LAYER.toast,
      )}
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
                className={cn(
                  "ml-1 shrink-0 select-none rounded-sm px-1.5 py-0.5 text-sm font-semibold underline-offset-2 hover:underline",
                  meta.dismissClass,
                )}
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
              {t.duration > 0 ? <CountdownRing key={t.cycle} duration={t.duration} armedAt={t.armedAt} /> : null}
              <X className="h-3 w-3" />
            </button>
          </output>
        );
      })}
    </div>
  );
}
