import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use relative paths so you don't have to change this if your repo name changes
  base: "./",
  build: {
    outDir: "docs",
  },
});
