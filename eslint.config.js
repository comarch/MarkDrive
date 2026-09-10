import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      ".claude/**",
      ".factory/**",
      ".worktrees/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["*.{js,ts}", "scripts/**/*.mjs"],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
);
