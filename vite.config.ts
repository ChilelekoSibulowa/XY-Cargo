import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

import { unlinkSync, existsSync } from "fs";

try {
  if (existsSync("push_status.txt")) {
    unlinkSync("push_status.txt");
  }
} catch (e) {}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
