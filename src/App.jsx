import { BrowserRouter, Route, Routes } from "react-router-dom";

import AboutPage from "@/pages/AboutPage";
import HomePage from "@/pages/HomePage";

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </BrowserRouter>
  );
}
