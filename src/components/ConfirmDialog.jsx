import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { DESTRUCTIVE_CONFIRM_CLASS, ExclamationMark, Modal } from "@/components/ui/Modal";

/**
 * Generic confirm dialog: a question, a confirm and a cancel. The shell (scrim, panel, Escape, scroll
 * lock, title row) comes from {@link Modal} — this file is only the two buttons and the copy.
 *
 * Focus lands on CANCEL, not confirm, and that matters most for the destructive uses: a stray Enter on
 * an unread dialog should do the harmless thing.
 *
 * Props:
 *   - open              — whether the dialog is shown.
 *   - title / message   — heading + body copy. `message` takes a node, so a dialog can emphasise part
 *                         of its sentence (see SaveCollisionDialog).
 *   - icon              — lucide component for the title row (see Modal). IGNORED when `destructive`.
 *   - confirmLabel      — confirm button text (default "Confirm").
 *   - cancelLabel       — cancel button text (default "Cancel").
 *   - destructive       — the whole high-risk treatment: exclamation icon + red outline confirm.
 *   - onConfirm / onCancel — handlers.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  icon = null,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const cancelButtonRef = useRef(null);

  return (
    <Modal
      open={open}
      title={title}
      // `destructive` CARRIES THE WHOLE TREATMENT — the exclamation icon AND the red confirm, together —
      // so a high-risk dialog cannot be built half-styled, and every one of them looks identical.
      //
      // IT OVERRIDES `icon` RATHER THAN DEFERRING TO IT, which is the point: Delete all passed a bin, and
      // a bin is a fine picture of deleting but a poor warning, so each destructive dialog drifted toward
      // illustrating its own verb. One mark across all of them is what makes the shape recognisable as
      // "this one is dangerous" before any of the words are read. `icon` still serves the non-destructive
      // dialogs (GlobeX, Lock), where there is no such thing to standardise on.
      icon={destructive ? ExclamationMark : icon}
      // The exclamation is drawn edge to edge, unlike the lucide glyphs the safe dialogs use, so it takes
      // the tighter disc. Rides along with `destructive` for the same reason the icon does: one flag, one
      // locked-in look.
      compactIcon={destructive}
      onClose={onCancel}
      closeLabel={cancelLabel}
      initialFocusRef={cancelButtonRef}
      titleId="confirm-dialog-title"
      descriptionId="confirm-dialog-desc"
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            shape="pill"
            className={destructive ? DESTRUCTIVE_CONFIRM_CLASS : "justify-center"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button ref={cancelButtonRef} type="button" variant="outline" shape="pill" className="justify-center" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      <p id="confirm-dialog-desc" className="text-sm leading-snug text-slate-600">
        {message}
      </p>
    </Modal>
  );
}
