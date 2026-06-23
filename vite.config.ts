import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "web"),
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: {
      // Solo /api/... va al backend. El "/" final evita capturar modulos
      // del frontend como /api.ts (clave regex: debe empezar por ^).
      "^/api/": "http://localhost:4711",
    },
  },
});
