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
 * NOT A SECURITY BOUNDARY: this is a static bundle, so both pages' code ships to every visitor either way.
 * See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
 */
const ADMIN_ROUTES = new Set(["poster", "social"]);
const isGatedRoute = ADMIN_ROUTES.has(route) && !IS_ADMIN;

// Put the address bar back to the tool root so a gated visit does not sit on a path that is not what is
// rendered. `replaceState` because no history entry should be spent on a route the visitor never got.
//
// NOT while a password is outstanding: `unlockAdmin` applies the unlock by reloading, so keeping the path
// is what lets `/poster?admin=1` come back as the poster rather than dumping the visitor on the tool.
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

// `body` must agree with whichever stage is on screen. Stamped on `documentElement` rather than `body`, and
// at module scope rather than in an effect. See docs/DECISIONS.md#body-background-propagates-to-the-canvas.
if (exportCanvasRoute !== null) {
  document.documentElement.dataset.exportCanvas = "";

  // KEEP THE EXPORT CANVASES OUT OF SEARCH RESULTS. This, not robots.txt, is what actually does it: the app
  // is served from a GitHub project page, so /egf/robots.txt is never fetched (crawlers only read the origin
  // root) and its Disallow rules are inert. A noindex meta tag travels with the document, so it works here
  // and keeps working on a custom domain.
  //
  // Injected rather than sitting in index.html because index.html is shared by every route — a static
  // noindex there would de-index the tool page itself. Runs before paint at module scope, but note the
  // ordering caveat: a crawler that reads only the raw HTML never sees this tag. That is acceptable because
  // such a crawler is also not running the JS that would render any poster content worth indexing.
  const noindex = document.createElement("meta");
  noindex.name = "robots";
  noindex.content = "noindex, nofollow";
  document.head.appendChild(noindex);
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
