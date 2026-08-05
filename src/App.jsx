import { AdminUnlockPrompt } from "@/components/AdminUnlockPrompt";

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

function RoutedPage() {
  // A gated route falls through to the tool rather than showing an error: there is nothing here a
  // visitor did wrong, and "this page does not exist for you" would only advertise that it exists.
  if (!isGatedRoute) {
    if (route === "poster") {
      return <PosterPage />;
    }
    if (route === "social") {
      return <SocialPage />;
    }
  }
  return <HomePage />;
}

export default function App() {
  return (
    <>
      <RoutedPage />
      {/* Renders nothing unless `?admin=1` was visited on a locked device. It overlays the routed page
          rather than replacing it, so cancelling (or a browser that never shows it) leaves a working
          app rather than a dead end — which is exactly what the `window.prompt` it replaced did not do.
          Outside RoutedPage so the question is askable on any route, gated or not. */}
      <AdminUnlockPrompt />
    </>
  );
}
