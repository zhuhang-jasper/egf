/**
 * Minimal path-based routing. The app is a single bundle served under Vite's
 * BASE_URL ("/" locally, "/egf/" on GitHub Pages), so we strip the base prefix
 * and return the first path segment as the route id.
 *
 * Deep links (e.g. /egf/poster) are served the SPA shell via public/404.html,
 * which round-trips the path through a redirect that index.html decodes before
 * React mounts — so window.location is already correct by the time this runs.
 */
const BASE = import.meta.env.BASE_URL || "/";

export function getRoute() {
  let path = window.location.pathname;
  if (path.startsWith(BASE)) {
    path = path.slice(BASE.length);
  }
  const segment = path.replace(/^\/+|\/+$/g, "").split("/")[0];
  return segment || "home";
}
