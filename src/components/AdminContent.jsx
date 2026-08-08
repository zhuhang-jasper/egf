import { Image, Share2 } from "lucide-react";

import { track } from "@/utils/analytics";
import { hrefForRoute } from "@/utils/route";

/**
 * The standalone pages this tab links out to. Both are full page loads rather than in-app tabs — they render
 * their own routes (see App.jsx), so they navigate away and come back via the poster/social back button.
 *
 * Each is a fixed-canvas export surface: the poster a portrait one-pager sized for the LinkedIn feed, the social
 * card the canonical Open Graph landscape for link previews. Both are for SHARING, not printing — the theory
 * tab's print button is the print path.
 *
 * NO PIXEL DIMENSIONS HERE ANY MORE. They were in these descriptions and are now shown on each page itself, in
 * its top-right export cluster — which is the better place for them twice over: it is where they are ACTIONABLE
 * (you want to know the canvas size while looking at the canvas and about to export it), and it keeps the number
 * next to the CANVAS_W/CANVAS_H constants that define it instead of restating it in a second file that has no
 * way to notice when those change.
 *
 * The PNG export is what these pages are FOR, so that does stay in the description rather than being left to be
 * discovered on arrival: both rasterize their canvas at its exact pixel size through the shared export pipeline
 * (see utils/export-image), offering copy-to-clipboard and download.
 */
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
 * The Admin tab: the dev-only shortcuts to the standalone Poster/Social pages.
 *
 * WHY A TAB RATHER THAN TWO ICONS IN THE THEORY TOOLBAR, which is where these lived. There they were a pair of
 * 32px squares next to the print button, sharing that row's treatment — so three unrelated jobs (print the
 * framework, open the poster page, open the social page) read as one group of equal weight, and the two that
 * navigate AWAY from the app looked like toolbar actions on the document below them. As their own destination
 * they are what they are: two pages, reached from the primary nav like any other page.
 *
 * It also puts the admin gate in ONE place. The toolbar version had `IS_ADMIN` inline in the middle of the
 * theory document's JSX; now the whole surface is gated where the tab is registered (AppBottomNav's item list
 * and HomePage's tab list), and this file assumes it is only ever rendered for an admin.
 *
 * THEY ARE ANCHORS, NOT BUTTONS, and that matters more here than it did at 32px: these are big targets for
 * page navigation, so cmd/middle-click to open in a new tab, the right-click menu, the URL on hover and a
 * screen reader announcing "link" are all things a reader will reasonably expect. Routing them through an
 * onClick handler would look identical and quietly take all of it away.
 *
 * `print:hidden` — dev shortcuts are not part of the printed reference document.
 */
export function AdminContent() {
  return (
    <div className="print:hidden">
      {/* TWO COLUMNS AT EVERY WIDTH, deliberately, because that is what was asked for and because two cards
          side by side are still comfortable at the app's 350px floor: each is ~160px wide, which fits the icon,
          a one-word label and a wrapped line of description without crowding. A `sm:` breakpoint stacking them
          on mobile would make the phone layout — the common one — the odd one out.

          THE ROWS ARE DECLARED HERE AND THE CARDS SUBSCRIBE TO THEM, which is what lines the two cards' innards
          up with each other. Each card is a `grid-rows-subgrid` child spanning all three rows, so icon, title and
          description are laid out against ROWS OF THIS GRID rather than each card's own box — the title band is
          one height across both cards, and so is the description band.

          Without subgrid, each card sized its own three children independently: the descriptions differ in
          length, so one wrapped to two lines and the other to three, and every element below the wrap sat at a
          different height in the two cards. Centring made it worse rather than better, pushing the mismatch into
          the icons and titles at the top as well. Stretching the cards to equal HEIGHT (which the grid already
          does) never fixes that on its own — equal boxes with differently-positioned contents.

          `items-stretch` is the grid default and is load-bearing here: a subgrid child has to fill the rows it
          spans for the shared row heights to mean anything. */}
      <div className="grid grid-cols-2 grid-rows-[auto_auto_1fr] gap-3">
        {ADMIN_LINKS.map(({ route, label, icon: Icon, description }) => (
          /* The card's own surface, matching the theory tab's cards (same radius, border and shadow) so the
             tab reads as part of the same app rather than a debug screen. The hover/active states are what
             make it read as a target: the border darkens and the fill tints, which is the same language the
             bottom nav's items use.

             `row-span-3 grid grid-rows-subgrid` — see the note on the container. `gap-2` here is the gap
             BETWEEN THE THREE ROWS inside the card; it does not fight the container's `gap-3`, which is the gap
             between the two cards.

             `focus-visible` ring rather than the browser default outline, to match the app's buttons — these
             are keyboard-reachable by definition, being links. */
          <a
            key={route}
            href={hrefForRoute(route)}
            /* These are full page loads, so GA logs a page_view for the destination either way. This
               records the ENTRY POINT, which the page_view can't: /poster and /social are also reachable
               by typing the URL, and only the click says the cards are how people get there. */
            onClick={() => track("admin_card_clicked", { route })}
            /* `select-none` — these are navigation targets, not prose. A card is a big tap area, so a slightly
               dragged click (or a long-press on touch) otherwise selects the label and description instead of
               following the link, and leaves the text highlighted afterwards. The same reason the bottom nav's
               items and the toolbar buttons carry it. */
            className="group row-span-3 grid select-none grid-rows-subgrid justify-items-center gap-2 rounded-xl border border-slate-300 bg-white p-6 text-center shadow-md shadow-slate-200/40 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <Icon className="size-8 shrink-0 text-slate-500 transition-colors group-hover:text-slate-900" aria-hidden />
            <span className="text-base font-bold text-slate-900">{label}</span>
            {/* The description is the reason the cards can afford to be this big: at 32px these were icon-only
                with a `title` attribute, which says nothing until you hover and nothing at all on touch.

                THE `1fr` ROW, so the descriptions share a band sized to the longer of the two and the shorter one
                simply leaves space below rather than pulling its card's contents up. */}
            <span className="text-xs leading-snug text-slate-500">{description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
