import { ArrowLeft } from "lucide-react";

import { hrefForRoute } from "@/utils/route";

/**
 * Top-left "back to the tool" link for the standalone Poster/Social pages (reached from the admin
 * tabs). Rendered in normal flow (self-aligned left) so it sits above the export canvas and pushes
 * the content down rather than overlapping it — and stays outside the rasterized PNG, which captures
 * only the canvas article. Admin unlock is persisted, so returning to `/` keeps the tabs unlocked.
 */
export function BackToToolButton() {
  return (
    <a
      href={hrefForRoute("home")}
      className="mb-4 self-start inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      Back to tool
    </a>
  );
}
