import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Restore saved font before first render
const savedFont = localStorage.getItem("dl_font");
if (savedFont && savedFont !== "jakarta") {
  document.documentElement.setAttribute("data-font", savedFont);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
