/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

// GitHub Pages serves the app from a repository subpath, container and
// custom-domain deployments serve it from the root.
const basePath = process.env.MARKQUIRE_BASE_PATH ?? "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
    // Playwright owns e2e/*.spec.ts and node --test owns the companion
    // suite; Vitest must not load either.
    exclude: [...configDefaults.exclude, "e2e/**", "companion/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["node_modules/**", "dist/**", "public/**", "**/*.d.ts"],
    },
  },
});
