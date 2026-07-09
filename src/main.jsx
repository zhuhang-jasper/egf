import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App.jsx";
import { initAnalytics } from "@/utils/analytics";
import { disableBrowserScrollRestoration } from "@/utils/scroll";

// Point Chart.js's in-canvas text (radar labels, ticks) at Inter too — must run before any
// chart mounts, so it lives here rather than in a page. See src/chart/defaults.js.
import "@/chart/defaults";

// Self-hosted Inter (variable) with BOTH the weight and optical-size (opsz) axes. Bundled
// locally so the app — and especially the client-side poster/social PNG exports — render
// identically on every device instead of falling back to each OS's system-ui font (SF on
// Mac, Roboto on Android, etc.). The opsz axis lets large display text tighten automatically
// (like SF Pro Display) via `font-optical-sizing: auto` — see the font stack in index.css.
import "@fontsource-variable/inter/opsz-italic.css";
import "@fontsource-variable/inter/opsz.css";
import "@/index.css";

disableBrowserScrollRestoration();
initAnalytics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
