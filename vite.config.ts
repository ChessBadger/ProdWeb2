import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // ← must exactly match your new repo name
  base: "/ProdWeb2/",
  build: {
    outDir: "docs",
  },
});
