import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * Svelte config. `vite.config.ts` configures the plugin for the build, but the
 * editor's Svelte language server resolves project config from this file only.
 * vite-plugin-svelte auto-loads it too, so the two stay in step.
 */
export default {
  preprocess: vitePreprocess(),
};
