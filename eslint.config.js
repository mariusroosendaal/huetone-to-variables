import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  ...svelte.configs["flat/recommended"],
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: "espree",
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".svelte"],
      },
      globals: globals.browser,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: config.files ?? ["**/*.{ts,tsx,mts,cts}"],
  })),
]);
