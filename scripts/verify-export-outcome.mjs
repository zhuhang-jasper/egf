/**
 * verify-export-outcome.mjs
 *
 * Fixture table for src/utils/export-outcome.js: what each image-export result should track and say. Pure
 * input → output, no DOM and no analytics, because the function only DESCRIBES the report — ChartSection's
 * reportExportOutcome is what calls track() and showToast().
 *
 * The asymmetry between Copy and Share is the point of the table, so most cases below assert on the pair
 * (event, method) rather than on either alone.
 *
 * Usage: node scripts/verify-export-outcome.mjs
 *
 * Exits 0 when every case passes, 1 on the first failing run (all failures are printed first).
 */

import { resolveExportOutcome } from "../src/utils/export-outcome.js";

const results = [];

function check(name, actual, expected) {
  results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
}

const CLIPBOARD = "Copied to clipboard";
const out = (method, kind) => resolveExportOutcome(method === null ? null : { method }, kind);
// The pair that has to stay distinct between the two buttons.
const tracked = (method, kind) => {
  const r = out(method, kind);
  return [r.event, r.method];
};

// --- copy --------------------------------------------------------------------
check("clipboard tracks as copied", tracked("clipboard", "copy"), ["chart_copied", "clipboard"]);
check("clipboard confirms", out("clipboard", "copy").toast, CLIPBOARD);
check("clipboard is a success toast", out("clipboard", "copy").toastVariant, "success");
// A DOWNLOAD IS TRACKED BUT NOT TOASTED: the browser's save sheet may be dismissed long after this resolves,
// so a toast would be a claim the app cannot check.
check("download tracks as copied", tracked("download", "copy"), ["chart_copied", "download"]);
check("download says nothing", out("download", "copy").toast, null);
check("download has no toast variant", out("download", "copy").toastVariant, null);

// --- share -------------------------------------------------------------------
// The native sheet's completion is out of our hands, so this tracks and stays silent.
check("share tracks as shared", tracked("share", "share"), ["chart_shared", "share"]);
check("share says nothing", out("share", "share").toast, null);
// A FALLBACK IS STILL A SHARE IN THE ANALYTICS. This is what one shared table has to preserve: the event
// names the button pressed, the method names the path taken.
check("the clipboard fallback stays a share event", tracked("share-fallback-clipboard", "share"), ["chart_shared", "fallback-clipboard"]);
// ...but it borrows Copy's wording, having landed on literally what Copy does.
check("the clipboard fallback speaks in Copy's words", out("share-fallback-clipboard", "share").toast, CLIPBOARD);
check("the download fallback stays a share event", tracked("share-fallback-download", "share"), ["chart_shared", "fallback-download"]);
check("the download fallback says nothing", out("share-fallback-download", "share").toast, null);

// --- failure ----------------------------------------------------------------
// An unrecognized method means the export did not complete: reported to the user, but NOT tracked, since
// there is no successful path to record.
check("a null result is not ok", out(null, "copy").ok, false);
check("a null result tracks nothing", tracked(null, "copy"), [null, null]);
check("copy failure names the copy button", out(null, "copy").toast, "Couldn't copy the image");
check("share failure names the share button", out(null, "share").toast, "Couldn't share the image");
check("a failure is an error toast", out(null, "share").toastVariant, "error");
// An unknown method string is a failure, not a silent success.
check("an unknown method is a failure", out("wat", "copy").ok, false);
check("an unknown method is reported", out("wat", "copy").toast, "Couldn't copy the image");
// A method belonging to the OTHER button is not valid here: copy never resolves "share".
check("copy does not accept a share method", out("share", "copy").ok, false);
check("share does not accept a copy method", out("clipboard", "share").ok, false);

// --- a bad kind is a programming error, not a user-facing failure -----------
let threw = false;
try {
  resolveExportOutcome({ method: "clipboard" }, "nope");
} catch {
  threw = true;
}
check("an unknown kind throws", threw, true);

const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.error(`FAIL  ${r.name}\n        expected ${JSON.stringify(r.expected)}\n        actual   ${JSON.stringify(r.actual)}`);
}
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
