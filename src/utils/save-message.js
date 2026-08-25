/**
 * The confirmation line for a completed save. Pure: a writeProfile result in, a string out — so the six
 * outcomes are stated in one place and can be checked without a browser (see verify-save-message.mjs).
 *
 * Every save confirms itself, because the button it came from does not: "Save" and "Update" leave the toolbar
 * looking much as they found it, and on a rename the only visible change is text the user typed themselves.
 */

/**
 * Past-tense verb keyed by the store's `mode`. DELIBERATELY ECHOES THE BUTTON that produced the save — the
 * statuses behind it are labelled Save/Rename/Update — so the notice reads as an answer to the thing the user
 * pressed rather than as the app's own separate account of what happened.
 *
 * `renamed` is the fallback for a rename with no prior title to name; the normal path phrases it as
 * "Renamed “<old>” to “<new>”" below.
 */
const SAVE_TOAST_VERB = {
  created: "Saved",
  renamed: "Renamed",
  updated: "Updated",
};

/**
 * `result` is writeProfile's "saved" payload; `renameWithEdits` says the save also carried level/badge
 * changes (the "Apply" button), which `mode` alone cannot express.
 *
 * A RENAME NAMES BOTH TITLES. The old one because it just left the screen and is what Undo reverts to; the
 * new one because the other modes name the current profile too, and the input above is not a reliable second
 * copy — it truncates a long name, and 8s is a short window to go looking.
 *
 * `removedTitle` is checked FIRST and reads "Merged": a resolved name collision renames the draft AND deletes
 * the row it clashed with, and `mode` alone reports that as a plain "Updated" — the only path where a profile
 * disappears without the notice saying so.
 */
export function buildSaveMessage(result, { renameWithEdits = false } = {}) {
  if (result?.removedTitle) {
    return `Merged “${result.removedTitle}” into “${result.savedTitle}”`;
  }
  if (result?.mode === "renamed" && result?.overwroteTitle) {
    // A rename that also changed values says so: "Renamed" alone would report half of what was written.
    return renameWithEdits
      ? `Renamed “${result.overwroteTitle}” to “${result.savedTitle}” and saved your changes`
      : `Renamed “${result.overwroteTitle}” to “${result.savedTitle}”`;
  }
  return `${SAVE_TOAST_VERB[result?.mode] ?? "Saved"} “${result?.savedTitle}”`;
}
