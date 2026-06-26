import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

// Versión real desde package.json, inyectada en el build como __APP_VERSION__.
// La sube `npm version` (un solo comando: bump + commit + tag). Ver CHANGELOG.md.
const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
);

export default defineConfig({
  root: resolve(import.meta.dirname, "web"),
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
