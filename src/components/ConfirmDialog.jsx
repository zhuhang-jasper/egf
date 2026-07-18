import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Generic confirm dialog. Portaled to <body> (like {@link ChangelogModal}); closes on backdrop
 * click, the cancel button, and Escape. Locks body scroll and focuses the cancel button while open.
 *
 * Props:
 *   - open              — whether the dialog is shown.
 *   - title / message   — heading + body copy.
 *   - confirmLabel      — confirm button text (default "Confirm").
 *   - cancelLabel       — cancel button text (default "Cancel").
 *   - destructive       — style the confirm button red (default false).
 *   - onConfirm / onCancel — handlers.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = false, onConfirm, onCancel }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      {/* Backdrop — click to cancel. */}
      <button type="button" aria-label={cancelLabel} onClick={onCancel} className="absolute inset-0 cursor-default bg-slate-900/50" />

      {/* Panel */}
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex flex-col gap-1.5">
          <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <p id="confirm-dialog-desc" className="text-sm leading-snug text-slate-600">
            {message}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            shape="pill"
            className={destructive ? "justify-center border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700" : "justify-center"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button ref={cancelButtonRef} type="button" variant="outline" shape="pill" className="justify-center" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
