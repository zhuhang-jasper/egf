import { AdminUnlockPrompt } from "@/components/AdminUnlockPrompt";
import { InstallPrompt } from "@/components/InstallPrompt";

import { ADMIN_PASSWORD_REQUESTED, IS_ADMIN } from "@/constants";
import HomePage from "@/pages/HomePage";
import PosterPage from "@/pages/PosterPage";
import SocialPage from "@/pages/SocialPage";
import { getRoute, hrefForRoute } from "@/utils/route";

// Routing is read once at module-eval time. The poster is a static, shareable
// snapshot — no in-app navigation between routes — so there's no need for a
// reactive router or history listener.
const route = getRoute();

/**
 * Routes that only exist for the admin (dev) build-a-share-image workflow.
 *
 * THESE WERE REACHABLE BY URL BY ANYONE, which made the admin unlock cosmetic for the two pages that
 * matter most: `IS_ADMIN` hid the Admin TAB — the link to them — while `/poster` and `/social` rendered
 * for whoever typed the path. Gating the affordance and not the destination protects nothing.
 *
 * THIS IS STILL A CLIENT-SIDE CHECK AND IS NOT A SECURITY BOUNDARY. The app is a static bundle on
 * GitHub Pages, so both pages' code ships to every visitor either way and the unlock flag can simply be
 * written by hand in devtools (see constants/features.js). What this buys is that the paths do not work
 * for someone who merely knows or guesses them, which is the actual exposure. Making these pages truly
 * unavailable to the public means not SHIPPING them: a build-time flag plus dynamic imports so Rollup
 * drops the chunks, not a stricter runtime test here.
 */
const ADMIN_ROUTES = new Set(["poster", "social"]);
const isGatedRoute = ADMIN_ROUTES.has(route) && !IS_ADMIN;

// Put the address bar back to the tool root, so a gated visit does not sit on a path that is not what
// is being rendered — a reload would otherwise land right back here, and a copied URL would still read
// as the poster. `hrefForRoute` because the base differs between local ("/") and Pages ("/egf/").
//
// `replaceState` rather than a redirect: there is no navigation to undo, and no history entry should be
// spent on a route the visitor never got. Same shape as the `?admin=` strip in constants/features.js,
// and for the same reason — the URL should describe what is on screen once the gate has been resolved.
//
// NOT WHILE A PASSWORD IS OUTSTANDING, though: `unlockAdmin` applies an unlock by reloading, so keeping
// the path means `/poster?admin=1` comes back as the poster. Rewrite it first and the correct password
// would land the visitor on the tool, having silently thrown away where they were going.
if (isGatedRoute && !ADMIN_PASSWORD_REQUESTED) {
  try {
    window.history.replaceState(window.history.state, "", hrefForRoute("home"));
  } catch {
    // history unavailable — the fall-through below still renders the tool.
  }
}

// Which of the two export canvases is being rendered, if either. `null` means the tool — including an
// unknown segment and a gated admin route, both of which fall through to it below.
//
// DERIVED ONCE AND SHARED, so the install banner's "not on an export canvas" test cannot drift from
// what is actually on screen. Re-deriving it from `route` down in App would have to repeat the
// `isGatedRoute` fall-through, and would silently start disagreeing the moment a third route existed.
const exportCanvasRoute = !isGatedRoute && (route === "poster" || route === "social") ? route : null;

// The export canvases sit on a BLACK stage, the tool on the app's `bg-slate-100` surround — and `body` has to
// agree with whichever is on screen, because a background on `body` propagates to the canvas and is therefore
// what an over-pull past either end of the document reveals. The stages set their own black (see PosterPage),
// which covers the document; it is only the rubber-band gap outside it that needs this.
//
// STAMPED ON `documentElement`, NOT `body`, and at module scope: `html` having no background of its own is the
// precondition for `body`'s propagating at all (see index.css and useScrollLock), so the flag goes on the
// element that must stay unpainted, and the paint stays in CSS. Module scope rather than an effect because the
// route is read once at module-eval time and never changes — an effect would leave the wrong colour painted for
// the first frame, which on this page is the one being looked at.
if (exportCanvasRoute !== null) {
  document.documentElement.dataset.exportCanvas = "";
}

function RoutedPage() {
  // A gated route falls through to the tool rather than showing an error: there is nothing here a
  // visitor did wrong, and "this page does not exist for you" would only advertise that it exists.
  if (exportCanvasRoute === "poster") {
    return <PosterPage />;
  }
  if (exportCanvasRoute === "social") {
    return <SocialPage />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <>
      <RoutedPage />

      {/* The floating "add to home screen" banner. Renders nothing unless there is an install path to
          offer and the user has not dismissed it recently — see components/InstallPrompt.

          NOT ON THE POSTER/SOCIAL ROUTES. Both are fixed-canvas surfaces that get rasterized to a PNG
          at an exact pixel size (see utils/export-image), so a floating banner over them is at best
          noise on a page whose only job is to be captured, and at worst lands in the exported image.
          They also have no bottom nav, which is what this banner's offset is measured against.

          Outside RoutedPage because it is `fixed`: its position comes from the viewport, not from the
          page's flow. Same reason AdminUnlockPrompt and the Toaster sit at this level. */}
      {exportCanvasRoute === null ? <InstallPrompt /> : null}

      {/* Renders nothing unless `?admin=1` was visited on a locked device. It overlays the routed page
          rather than replacing it, so cancelling (or a browser that never shows it) leaves a working
          app rather than a dead end — which is exactly what the `window.prompt` it replaced did not do.
          Outside RoutedPage so the question is askable on any route, gated or not. */}
      <AdminUnlockPrompt />
    </>
  );
}
