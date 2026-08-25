/**
 * verify-save-message.mjs
 *
 * Fixture table for src/utils/save-message.js: which sentence each save outcome produces. Pure input →
 * output, no DOM and no store, which is the point of the function living outside the component.
 *
 * Usage: node scripts/verify-save-message.mjs
 *
 * Exits 0 when every case passes, 1 on the first failing run (all failures are printed first).
 */

import { buildSaveMessage } from "../src/utils/save-message.js";

const results = [];

function check(name, actual, expected) {
  results.push({ name, pass: actual === expected, actual, expected });
}

// A writeProfile "saved" payload, with only the fields the message reads.
const saved = (over) => ({ status: "saved", savedTitle: "Beta", overwroteTitle: null, removedTitle: null, mode: "updated", ...over });

check("create names the new profile", buildSaveMessage(saved({ mode: "created" })), "Saved “Beta”");
check("update names the profile", buildSaveMessage(saved({ mode: "updated" })), "Updated “Beta”");

// A rename names BOTH titles — the old one is what just left the screen and what Undo reverts to.
check("rename names both titles", buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Alpha" })), "Renamed “Alpha” to “Beta”");
check(
  "rename WITH edits says so",
  buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Alpha" }), { renameWithEdits: true }),
  "Renamed “Alpha” to “Beta” and saved your changes",
);
// renameWithEdits is meaningless off the rename path, and must not leak into the other sentences.
check("renameWithEdits is ignored on a plain update", buildSaveMessage(saved({ mode: "updated" }), { renameWithEdits: true }), "Updated “Beta”");

// A merge is reported as `updated` by `mode`, so it MUST be checked first or a deleted profile goes unmentioned.
check("merge names the absorbed profile", buildSaveMessage(saved({ removedTitle: "Alpha" })), "Merged “Alpha” into “Beta”");
check(
  "merge wins over the rename phrasing",
  buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Beta", removedTitle: "Alpha" })),
  "Merged “Alpha” into “Beta”",
);

// A rename with no prior title to name (an imported row can hold "") falls back to the bare verb.
check("rename with no old title falls back", buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "" })), "Renamed “Beta”");
check("an unknown mode falls back to Saved", buildSaveMessage(saved({ mode: "wat" })), "Saved “Beta”");

const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.error(`FAIL  ${r.name}\n        expected ${JSON.stringify(r.expected)}\n        actual   ${JSON.stringify(r.actual)}`);
}
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
