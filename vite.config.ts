import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Percorsi relativi: l'app funziona sia in root sia in una sottocartella
  // (es. GitHub Pages: tuonome.github.io/mytan/), senza sapere il nome del repo.
  base: "./",
  plugins: [react()],
  server: { port: 5173 },
});
