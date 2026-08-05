import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<user>.github.io/alerify_calc/ — set the base path so
// asset URLs resolve correctly on GitHub Pages.
export default defineConfig({
  base: "/alerify_calc/",
  plugins: [react()],
});
