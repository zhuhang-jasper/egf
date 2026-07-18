import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Confirm dialog shown when a save would create a second profile sharing another profile's
 * name+badge. Identity is tracked by uuid, so a duplicate name is allowed — the user just has to
 * choose intent:
 *
 *   - Overwrite it  → write into the existing (clashing) profile.
 *   - Cancel        → back out and edit the name.
 *
 * Portaled to <body> (like {@link ChangelogModal}); closes on backdrop click, Cancel, and Escape.
 * `collision` is the pending result from the store's writeProfile ({ id, name, badge }); null hides
 * the dialog.
 */
export function SaveCollisionDialog({ collision, onOverwrite, onCancel }) {
  const cancelButtonRef = useRef(null);
  const open = collision != null;

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
      aria-labelledby="save-collision-title"
      aria-describedby="save-collision-desc"
    >
      {/* Backdrop — click to cancel. */}
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 cursor-default bg-slate-900/50" />

      {/* Panel */}
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex flex-col gap-1.5">
          <h2 id="save-collision-title" className="text-base font-bold text-slate-900">
            Name already used
          </h2>
          <p id="save-collision-desc" className="text-sm leading-snug text-slate-600">
            A profile named <span className="font-semibold text-slate-900">“{collision.name}”</span> with the same badge already exists. What would
            you like to do?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            shape="pill"
            className="justify-center border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onOverwrite}
          >
            Overwrite it
          </Button>
          <Button ref={cancelButtonRef} type="button" variant="outline" shape="pill" className="justify-center" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
