import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { CHANGELOG } from "@/constants";
import { cn } from "@/utils";

/**
 * Centered changelog modal for the Theory tab. Portaled to <body> so it escapes the tab panel's
 * stacking/overflow context and sits over the whole page. Closes on backdrop click, the ✕ button,
 * and Escape; locks body scroll and moves focus to the close button while open.
 *
 * Content comes from the {@link CHANGELOG} constant (newest entry first): version + date + a list
 * of change bullets.
 */
export function ChangelogModal({ open, onClose }) {
  const closeButtonRef = useRef(null);

  // Escape to close + body-scroll lock, only while open.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the close button so keyboard users land inside the dialog.
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
    >
      {/* Backdrop — click to dismiss. */}
      <button type="button" aria-label="Close changelog" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/50" />

      {/* Panel */}
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 id="changelog-modal-title" className="text-base font-bold text-slate-900">
            Changelog
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <X className="size-4.5" aria-hidden />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          <ol className="space-y-5">
            {CHANGELOG.map((entry) => (
              <li key={entry.version} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-900">v{entry.version}</span>
                  <span className="text-xs font-medium text-slate-400">{entry.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.changes.map((change, index) => (
                    <li key={index} className={cn("flex gap-2 text-[13px] leading-snug text-slate-700")}>
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  );
}
