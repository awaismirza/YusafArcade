import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the site from a subpath (/YusafArcade/), so asset URLs need this base.
  base: "/YusafArcade/",
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});