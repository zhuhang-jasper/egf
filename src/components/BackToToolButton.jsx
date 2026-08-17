import { ArrowLeft } from "lucide-react";

import { hrefForRoute } from "@/utils/route";

/**
 * "Back to the tool" link for the standalone Poster/Social pages (reached from the Admin tab). Just the link —
 * its placement is the page's business, and each one puts it in a top chrome row alongside that page's own
 * canvas-size label.
 *
 * Rendered in normal flow rather than absolutely positioned, so it sits above the export canvas and pushes the
 * content down instead of overlapping it — and it stays outside the rasterized PNG, which captures only the
 * canvas `<article>`. Admin unlock is persisted, so returning to `/` keeps the Admin tab unlocked.
 */
export function BackToToolButton() {
  return (
    <a
      href={hrefForRoute("home")}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      Back
    </a>
  );
}
