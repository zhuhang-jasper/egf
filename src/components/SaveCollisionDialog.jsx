import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Confirm dialog shown when a save would create a second profile sharing another profile's
 * name+badge. Identity is tracked by uuid, so a duplicate name is allowed — the user just has to
 * choose intent:
 *
 *   - Overwrite it  → write into the existing (clashing) profile.
 *   - Cancel        → back out and edit the name.
 *
 * A `destructive` {@link ConfirmDialog}, which is what gives it the exclamation icon and red outline
 * confirm shared by every high-risk dialog. It stays its own component only to hold the interpolated
 * message (the clashing name, emphasised) and to name what it is at the call site.
 *
 * `collision` is the pending result from the store's writeProfile ({ id, name, badge }); null hides it.
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
