/** Past-tense verb per save `mode`, echoing the button that produced it (Save / Rename / Update). */
const SAVE_TOAST_VERB = {
  created: "Saved",
  renamed: "Renamed",
  updated: "Updated",
};

/**
 * The confirmation line for a save. `result` is writeProfile's "saved" payload; `renameWithEdits` marks the
 * "Apply" case, which `mode` cannot express.
 *
 * `removedTitle` is tested FIRST: a resolved collision reports `mode: "updated"`, so checking mode first would
 * leave the deleted profile unmentioned. A rename names both titles — the old one is what Undo reverts to.
 */
export function buildSaveMessage(result, { renameWithEdits = false } = {}) {
  if (result?.removedTitle) {
    return `Merged “${result.removedTitle}” into “${result.savedTitle}”`;
  }
  if (result?.mode === "renamed" && result?.overwroteTitle) {
    return renameWithEdits
      ? `Renamed “${result.overwroteTitle}” to “${result.savedTitle}” and saved your changes`
      : `Renamed “${result.overwroteTitle}” to “${result.savedTitle}”`;
  }
  return `${SAVE_TOAST_VERB[result?.mode] ?? "Saved"} “${result?.savedTitle}”`;
}
