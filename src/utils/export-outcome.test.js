import { describe, expect, it } from "vitest";

import { resolveExportOutcome } from "@/utils/export-outcome";

// The asymmetry between Copy and Share is the point of the table, so most cases assert on the pair
// (event, method) rather than on either alone.
const CLIPBOARD = "Copied to clipboard";
const out = (method, kind) => resolveExportOutcome(method === null ? null : { method }, kind);
const tracked = (method, kind) => {
  const r = out(method, kind);
  return [r.event, r.method];
};

describe("copy", () => {
  it("clipboard tracks as copied", () => {
    expect(tracked("clipboard", "copy")).toEqual(["chart_copied", "clipboard"]);
  });
  it("clipboard confirms", () => {
    expect(out("clipboard", "copy").toast).toBe(CLIPBOARD);
  });
  it("clipboard is a success toast", () => {
    expect(out("clipboard", "copy").toastVariant).toBe("success");
  });
  // A DOWNLOAD IS TRACKED BUT NOT TOASTED: the browser's save sheet may be dismissed long after this resolves,
  // so a toast would be a claim the app cannot check.
  it("download tracks as copied", () => {
    expect(tracked("download", "copy")).toEqual(["chart_copied", "download"]);
  });
  it("download says nothing", () => {
    expect(out("download", "copy").toast).toBeNull();
  });
  it("download has no toast variant", () => {
    expect(out("download", "copy").toastVariant).toBeNull();
  });
});

describe("share", () => {
  // The native sheet's completion is out of our hands, so this tracks and stays silent.
  it("share tracks as shared", () => {
    expect(tracked("share", "share")).toEqual(["chart_shared", "share"]);
  });
  it("share says nothing", () => {
    expect(out("share", "share").toast).toBeNull();
  });
  // A FALLBACK IS STILL A SHARE IN THE ANALYTICS: the event names the button pressed, the method the path taken.
  it("the clipboard fallback stays a share event", () => {
    expect(tracked("share-fallback-clipboard", "share")).toEqual(["chart_shared", "fallback-clipboard"]);
  });
  // ...but it borrows Copy's wording, having landed on literally what Copy does.
  it("the clipboard fallback speaks in Copy's words", () => {
    expect(out("share-fallback-clipboard", "share").toast).toBe(CLIPBOARD);
  });
  it("the download fallback stays a share event", () => {
    expect(tracked("share-fallback-download", "share")).toEqual(["chart_shared", "fallback-download"]);
  });
  it("the download fallback says nothing", () => {
    expect(out("share-fallback-download", "share").toast).toBeNull();
  });
});

describe("failure", () => {
  // An unrecognized method means the export did not complete: reported to the user, but NOT tracked.
  it("a null result is not ok", () => {
    expect(out(null, "copy").ok).toBe(false);
  });
  it("a null result tracks nothing", () => {
    expect(tracked(null, "copy")).toEqual([null, null]);
  });
  it("copy failure names the copy button", () => {
    expect(out(null, "copy").toast).toBe("Couldn't copy the image");
  });
  it("share failure names the share button", () => {
    expect(out(null, "share").toast).toBe("Couldn't share the image");
  });
  it("a failure is an error toast", () => {
    expect(out(null, "share").toastVariant).toBe("error");
  });
  it("an unknown method is a failure", () => {
    expect(out("wat", "copy").ok).toBe(false);
  });
  it("an unknown method is reported", () => {
    expect(out("wat", "copy").toast).toBe("Couldn't copy the image");
  });
  // A method belonging to the OTHER button is not valid here: copy never resolves "share".
  it("copy does not accept a share method", () => {
    expect(out("share", "copy").ok).toBe(false);
  });
  it("share does not accept a copy method", () => {
    expect(out("clipboard", "share").ok).toBe(false);
  });
  // A bad kind is a programming error, not a user-facing failure.
  it("an unknown kind throws", () => {
    expect(() => resolveExportOutcome({ method: "clipboard" }, "nope")).toThrow();
  });
});
