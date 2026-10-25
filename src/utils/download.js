/** How long the object URL outlives the click. Revoking synchronously cancels the download in some browsers. */
const REVOKE_DELAY_MS = 10_000;

/** Save a Blob as a file via an anchor click. Fire-and-forget: the browser gives no completion signal. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
