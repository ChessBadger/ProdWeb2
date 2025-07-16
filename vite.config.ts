import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // must match your repo name
  base: "/test_repo/",
  build: {
    outDir: "docs",
  },
});
