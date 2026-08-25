import { Check } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * Shown before an action clears pillar warnings the user hasn't looked at. The stamp is one field on the
 * profile, so anything that advances it re-asserts the WHOLE profile — silencing every flagged pillar at
 * once, not just the ones edited. This is the one chance to say so before it happens.
 *
 * `restamp` switches it from the save path (a level edit bumped the stamp) to the caret's "Mark as rated"
 * (which bumps it deliberately, and holds the Updated date).
 *
 * `destructiveConfirm`, not `destructive`: the confirm is red because warnings are lost for good, but nothing
 * is deleted and the scores survive, so it keeps its own tick rather than the high-risk exclamation.
 * A bare tick, so it takes the full disc like the exclamation does rather than lucide's inset sizing —
 * confirming here is an acknowledgement, not a hazard.
 */
export function UnreviewedWarningsDialog({ count, restamp = false, onConfirm, onCancel }) {
  const pillars = (
    <span className="font-semibold text-slate-900">
      {count} pillar{count === 1 ? "" : "s"}
    </span>
  );
  const them = count === 1 ? "it" : "them all";

  return (
    <ConfirmDialog
      open={count > 0}
      title="Unreviewed pillar warnings"
      icon={Check}
      bareGlyph
      destructiveConfirm
      message={
        restamp ? (
          <>
            {pillars} {count === 1 ? "has a warning" : "have warnings"} you haven&rsquo;t reviewed. Marking this profile as rated against the current
            framework clears {them}. This profile's Updated Date will remain unchanged.
          </>
        ) : (
          <>
            {pillars} still {count === 1 ? "has a warning" : "have warnings"} you haven&rsquo;t reviewed. Saving marks the whole profile as rated
            against the current framework, which clears {them}.
          </>
        )
      }
      confirmLabel={restamp ? "Mark anyway" : "Save anyway"}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
