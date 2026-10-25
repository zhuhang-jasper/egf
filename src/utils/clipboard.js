export function canWriteClipboardImage() {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

/**
 * Write a PNG to the clipboard. Takes a Promise<Blob> as well as a Blob: handing ClipboardItem the pending render
 * is the spec'd way to copy async-generated content, since the browser holds the clipboard-write permission across
 * the await instead of letting the gesture window expire. Safari requires this form; Chrome/Firefox accept it too.
 */
export async function writeClipboardImage(blobOrPromise) {
  if (!canWriteClipboardImage()) {
    throw new Error("Clipboard image write is not supported in this browser");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobOrPromise })]);
}
