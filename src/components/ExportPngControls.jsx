import { Copy, Download } from "lucide-react";

/**
 * Copy / Download buttons for the standalone share pages (Poster, Social).
 *
 * TOP CHROME, NOT AN OVERLAY. These used to float inside the `<article>` at `top-4 right-4`, kept out of the
 * capture by `data-export-ignore` — which worked, but meant the controls sat on top of the artwork they export
 * and scaled with the preview, so they shrank on a narrow viewport. In the toolbar they are page chrome: ordinary
 * flow, fixed size, and no capture-time opt-out to maintain.
 *
 * LABELS NEVER CHANGE. They used to swap through "Copying…" / "✓ Copied" / "Copy failed", which resized the
 * button mid-interaction and shoved its neighbour sideways — in a toolbar that also pushes the centred canvas-size
 * label off-centre. Outcome is reported by a toast instead (see the pages' runExport); the only state these carry
 * is `disabled` while an export runs, which changes nothing about their geometry.
 *
 * Styled as BackToToolButton is (pill, `border-white/20 bg-white/10`, white semibold), since every control on the
 * black chrome now reads as one set.
 */
const BUTTON_CLASS =
  "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-wait disabled:opacity-60";

export function ExportPngControls({ onCopy, onDownload, busy }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={onCopy} disabled={busy} className={BUTTON_CLASS}>
        <Copy className="size-4 shrink-0" aria-hidden />
        Copy
      </button>
      <button type="button" onClick={onDownload} disabled={busy} className={BUTTON_CLASS}>
        <Download className="size-4 shrink-0" aria-hidden />
        Download
      </button>
    </div>
  );
}
