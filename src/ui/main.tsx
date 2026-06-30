import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "./store";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

// Service worker per l'offline: registrato solo nella build di produzione
// (in sviluppo interferirebbe con l'hot-reload di Vite).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // URL relativo alla pagina: regge sia root sia sottocartella (GitHub Pages).
    const swUrl = new URL("sw.js", document.baseURI).toString();
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn("Registrazione service worker fallita:", err);
    });
  });
}
