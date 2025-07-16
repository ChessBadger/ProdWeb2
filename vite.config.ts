import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 👉 this must match your repo name
  base: "/test_repo/",
  build: {
    // output into docs/ for GitHub Pages
    outDir: "docs",
  },
});
