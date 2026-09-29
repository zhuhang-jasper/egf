import { describe, expect, it } from "vitest";

import { buildSaveMessage } from "@/utils/save-message";

// A writeProfile "saved" payload, with only the fields the message reads.
const saved = (over) => ({ status: "saved", savedTitle: "Beta", overwroteTitle: null, removedTitle: null, mode: "updated", ...over });

describe("buildSaveMessage", () => {
  it("create names the new profile", () => {
    expect(buildSaveMessage(saved({ mode: "created" }))).toBe("Saved “Beta”");
  });
  it("update names the profile", () => {
    expect(buildSaveMessage(saved({ mode: "updated" }))).toBe("Updated “Beta”");
  });

  // A rename names BOTH titles — the old one is what just left the screen and what Undo reverts to.
  it("rename names both titles", () => {
    expect(buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Alpha" }))).toBe("Renamed “Alpha” to “Beta”");
  });
  it("rename WITH edits says so", () => {
    expect(buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Alpha" }), { renameWithEdits: true })).toBe(
      "Renamed “Alpha” to “Beta” and saved your changes",
    );
  });
  // renameWithEdits is meaningless off the rename path, and must not leak into the other sentences.
  it("renameWithEdits is ignored on a plain update", () => {
    expect(buildSaveMessage(saved({ mode: "updated" }), { renameWithEdits: true })).toBe("Updated “Beta”");
  });

  // A merge is reported as `updated` by `mode`, so it MUST be checked first or a deleted profile goes unmentioned.
  it("merge names the absorbed profile", () => {
    expect(buildSaveMessage(saved({ removedTitle: "Alpha" }))).toBe("Merged “Alpha” into “Beta”");
  });
  it("merge wins over the rename phrasing", () => {
    expect(buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "Beta", removedTitle: "Alpha" }))).toBe("Merged “Alpha” into “Beta”");
  });

  // A rename with no prior title to name (an imported row can hold "") falls back to the bare verb.
  it("rename with no old title falls back", () => {
    expect(buildSaveMessage(saved({ mode: "renamed", overwroteTitle: "" }))).toBe("Renamed “Beta”");
  });
  it("an unknown mode falls back to Saved", () => {
    expect(buildSaveMessage(saved({ mode: "wat" }))).toBe("Saved “Beta”");
  });
});
