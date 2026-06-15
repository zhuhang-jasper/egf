import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App.jsx";
import { disableBrowserScrollRestoration } from "@/utils/scroll";

import "@/index.css";

disableBrowserScrollRestoration();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
