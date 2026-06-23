import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App.jsx";
import { initAnalytics } from "@/utils/analytics";
import { disableBrowserScrollRestoration } from "@/utils/scroll";

import "@/index.css";

disableBrowserScrollRestoration();
initAnalytics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
