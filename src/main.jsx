import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { disableBrowserScrollRestoration } from "@/utils/scroll";

import App from "@/App.jsx";

import "@/index.css";

disableBrowserScrollRestoration();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
