import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Inter is the documented fallback family for the primary brand font.
// Self-hosted weights avoid external font CDNs in enterprise deployments.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "katex/dist/katex.min.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline shell caching runs only in production builds; a service worker
// in the dev server would fight hot module reloading.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
