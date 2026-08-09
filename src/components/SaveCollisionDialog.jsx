import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Shown when a save would create a second profile sharing another's name+badge. Identity is by uuid, so a
 * duplicate name is allowed and the user only has to choose intent: overwrite the clashing profile, or
 * cancel and rename.
 *
 * Its own component only to hold the interpolated message and name itself at the call site. `collision` is
 * writeProfile's pending result; null hides it.
 */
export function SaveCollisionDialog({ collision, onOverwrite, onCancel }) {
  return (
    <ConfirmDialog
      open={collision != null}
      title="Name already used"
      message={
        <>
          A profile named <span className="font-semibold text-slate-900">“{collision?.name}”</span> with the same badge already exists. What would you
          like to do?
        </>
      }
      confirmLabel="Overwrite it"
      destructive
      onConfirm={onOverwrite}
      onCancel={onCancel}
    />
  );
}
