/**
 * What an image-export attempt should report. Pure lookup, no DOM and no analytics calls, so
 * verify-export-outcome.mjs runs it under bare node; the caller performs whatever this describes.
 * See docs/DECISIONS.md#export-reporting-is-asymmetric
 */

/** Toast text, keyed so the error copy names the button the user pressed. */
const TOAST = {
  clipboard: "Copied to clipboard",
  copyFailed: "Couldn't copy the image",
  shareFailed: "Couldn't share the image",
};

const OUTCOMES = {
  copy: {
    event: "chart_copied",
    failureToast: TOAST.copyFailed,
    methods: {
      clipboard: { method: "clipboard", toast: TOAST.clipboard },
      download: { method: "download", toast: null },
    },
  },
  share: {
    event: "chart_shared",
    failureToast: TOAST.shareFailed,
    methods: {
      "share": { method: "share", toast: null },
      "share-fallback-clipboard": { method: "fallback-clipboard", toast: TOAST.clipboard },
      "share-fallback-download": { method: "fallback-download", toast: null },
    },
  },
};

/**
 * `kind` is which button was pressed; only `result.method` is read. On failure nothing is tracked: an
 * unrecognized method means the export did not complete, so it is reported to the user, not recorded.
 */
export function resolveExportOutcome(result, kind) {
  const table = OUTCOMES[kind];
  if (!table) {
    throw new Error(`resolveExportOutcome: unknown kind "${kind}"`);
  }
  const hit = table.methods[result?.method];
  if (!hit) {
    return { ok: false, event: null, method: null, toast: table.failureToast, toastVariant: "error" };
  }
  return { ok: true, event: table.event, method: hit.method, toast: hit.toast, toastVariant: hit.toast ? "success" : null };
}
