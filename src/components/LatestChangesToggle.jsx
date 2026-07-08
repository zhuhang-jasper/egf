import { Highlighter } from "lucide-react";

import { cn } from "@/utils";

/**
 * Page-level "What's New" switch for the Theory tab's highlighter. When on, the newer/expanded
 * framework material (marked with **…** in the copy) shows the amber marker fill; when off it reads
 * as plain text. Version-agnostic by design — the markers persist across minor framework edits, so
 * this label never needs a version number. Styled as a compact pill so it can sit top-right above
 * the first section without competing with the headings.
 */
export function LatestChangesToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:text-[12px]",
        show
          ? "border-amber-300 bg-amber-200/60 text-amber-900 hover:bg-amber-200/80"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      )}
    >
      <Highlighter className="size-3.5" aria-hidden />
      What's New: {show ? "on" : "off"}
    </button>
  );
}
