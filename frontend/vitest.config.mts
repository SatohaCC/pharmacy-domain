import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { stylexVitePlugin } from "./config/stylexVitePlugin.mts";

export default defineConfig({
  plugins: [stylexVitePlugin({ rootDir: import.meta.dirname, test: true }), react()],
  cacheDir: path.resolve(import.meta.dirname, "../.cache/vitest"),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
