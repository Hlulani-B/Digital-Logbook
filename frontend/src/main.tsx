import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Restore saved font before first render
const savedFont = localStorage.getItem("dl_font");
if (savedFont && savedFont !== "lora") {
  document.documentElement.setAttribute("data-font", savedFont);
}

// Restore saved corner style before first render
const savedCorners = localStorage.getItem("dl_corners");
if (savedCorners && savedCorners !== "rounded") {
  document.documentElement.setAttribute("data-corners", savedCorners);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
