import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // ← makes all asset/JSON URLs relative
  build: {
    outDir: "docs", // ← output goes to docs/
  },
});
