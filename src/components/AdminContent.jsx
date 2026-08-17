import { Image, Share2 } from "lucide-react";

import { CARD_PLAIN } from "@/styles/card";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { hrefForRoute } from "@/utils/route";

/** Full page loads with their own routes (see App.jsx). No pixel dimensions here: each page shows its own. */
const ADMIN_LINKS = [
  {
    route: "poster",
    label: "Poster",
    icon: Image,
    description: "Share-ready one-page poster, downloadable as a PNG.",
  },
  {
    route: "social",
    label: "Social",
    icon: Share2,
    description: "Link-share thumbnail, downloadable as a PNG.",
  },
];

/**
 * The Admin tab: dev-only shortcuts to the Poster/Social pages. This file assumes it is only ever rendered
 * for an admin. Anchors, not buttons, so cmd/middle-click, the context menu and the hover URL all work.
 */
export function AdminContent() {
  return (
    <div className="print:hidden">
      {/* The rows are declared HERE and each card subscribes via `grid-rows-subgrid`, so the icon, title and
          description bands are one height across both cards. Without it each card sizes its three children
          independently, and a description that wraps to a different line count offsets everything below it.
          Equal card heights alone do not fix that. `items-stretch` (the grid default) is load-bearing: a
          subgrid child must fill the rows it spans for the shared heights to mean anything. */}
      <div className="grid grid-cols-2 grid-rows-[auto_auto_1fr] gap-3">
        {ADMIN_LINKS.map(({ route, label, icon: Icon, description }) => (
          /* `gap-2` is the gap between the card's three rows; the container's `gap-3` is between the cards. */
          <a
            key={route}
            href={hrefForRoute(route)}
            // Records the ENTRY POINT, which the destination's own page_view cannot: those routes are also
            // reachable by typing the URL.
            onClick={() => track("admin_card_clicked", { route })}
            className={cn(
              CARD_PLAIN,
              "group row-span-3 grid select-none grid-rows-subgrid justify-items-center gap-2 p-6 text-center transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
            )}
          >
            <Icon className="size-8 shrink-0 text-slate-500 transition-colors group-hover:text-slate-900" aria-hidden />
            <span className="text-base font-bold text-slate-900">{label}</span>
            {/* The `1fr` row, so both descriptions share a band sized to the longer one. */}
            <span className="text-xs leading-snug text-slate-500">{description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
