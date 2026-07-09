import { Highlighter } from "lucide-react";

import { cn } from "@/utils";

/**
 * Page-level "What's New" switch for the Theory tab's highlighter. When on, the newer/expanded
 * framework material (marked with **…** in the copy) shows the amber marker fill; when off it reads
 * as plain text. Version-agnostic by design — the markers persist across minor framework edits, so
 * this label never needs a version number.
 *
 * Rendered as a static label + mini switch (not a stateful button label): the knob/track shows the
 * state, so the text never needs an "on/off" suffix. The whole row is one switch button — clicking
 * anywhere on it toggles.
 */
export function LatestChangesToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      className="group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1 pl-2.5 pr-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800 sm:text-[12px]"
    >
      <Highlighter className="size-3.5 shrink-0" aria-hidden />
      Show what's new
      {/* Mini switch: amber track when on, slate when off; knob slides right when on. */}
      <span
        aria-hidden
        className={cn(
          "relative ml-0.5 inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
          show ? "bg-amber-400" : "bg-slate-300 group-hover:bg-slate-400/70",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
            show && "translate-x-3",
          )}
        />
      </span>
    </button>
  );
}
