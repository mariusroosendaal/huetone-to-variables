import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import type { OutputBundle, OutputOptions, OutputAsset } from "rollup";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Escape special regex characters in a string for use in RegExp constructor
 */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Custom Vite plugin to handle SVG imports from figma-ui3-kit-svelte
 *
 * Problem: The UI3 Kit imports SVG files that need to be bundled into the HTML
 * Solution: Convert SVG files to inline strings so they can be embedded in the bundle
 */
function ui3InlineSvg(): Plugin {
  return {
    name: "ui3-inline-svg",
    enforce: "pre",
    load(id) {
      // Only process SVG files from the figma-ui3-kit-svelte package
      if (!id.includes("figma-ui3-kit-svelte")) return;
      if (!id.includes(".svg")) return;
      const filePath = id.split("?")[0];
      if (!filePath.endsWith(".svg")) return;

      // Read SVG content and return it as a JSON string export
      const svg = readFileSync(filePath, "utf-8");
      return `export default ${JSON.stringify(svg)};`;
    },
  };
}

/**
 * Custom Vite plugin to inline all CSS and JS into a single HTML file for Figma
 *
 * Problem: Figma plugins require a single HTML file with no external dependencies
 * Solution: This plugin takes the built HTML/CSS/JS and inlines everything into one file,
 *          producing a self-contained `index.html` for the UI
 *
 * IMPORTANT: Uses function replacement in String.replace() to avoid $ pattern
 * interpretation in minified code (e.g., $& would be replaced with the matched string)
 */
function inlineFigmaHtml(): Plugin {
  return {
    name: "inline-figma-html",
    apply: "build",
    enforce: "post",
    generateBundle(_options: OutputOptions, bundle: OutputBundle) {
      // Find the HTML file in the bundle
      const htmlKey =
        Object.keys(bundle).find((key) => key.endsWith("index.html")) ?? "";
      const htmlAsset = htmlKey ? bundle[htmlKey] : undefined;
      if (!htmlAsset || htmlAsset.type !== "asset") return;

      let html = String(htmlAsset.source);

      // Remove modulepreload links (not needed in inlined version)
      html = html.replace(/<link\s+[^>]*rel=["']modulepreload["'][^>]*>/gi, "");

      // Step 1: Inline all CSS files into <style> tags
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset") continue;
        if (!fileName.endsWith(".css")) continue;
        const css = String(asset.source ?? "");

        // Find the <link> tag for this CSS file and replace with inline <style>
        const hrefPattern = new RegExp(
          `<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
            fileName
          )}["'][^>]*>`,
          "i"
        );
        if (hrefPattern.test(html)) {
          // Use function replacement to avoid $ pattern interpretation in CSS
          html = html.replace(hrefPattern, () => `<style>${css}</style>`);
          delete bundle[fileName]; // Remove CSS file from bundle
        }
      }

      // Step 2: Inline all JS chunks into <script> tags
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;

        // Find the <script> tag for this JS file and replace with inline script
        const scriptPattern = new RegExp(
          `<script[^>]+src=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
            fileName
          )}["'][^>]*></script>`,
          "i"
        );
        if (scriptPattern.test(html)) {
          // Use function replacement to avoid $ pattern interpretation in minified JS
          // Use regular script (not module) for Figma sandbox compatibility
          html = html.replace(
            scriptPattern,
            () => `<script>${chunk.code}</script>`
          );
          // Remove any modulepreload links for this chunk
          html = html.replace(
            new RegExp(
              `<link[^>]+rel=["']modulepreload["'][^>]+href=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
                fileName
              )}["'][^>]*>`,
              "gi"
            ),
            ""
          );
          delete bundle[fileName]; // Remove JS file from bundle
        }
      }

      // Update the HTML asset with our inlined version
      (htmlAsset as OutputAsset).source = html;
      if (htmlKey !== "index.html") {
        delete bundle[htmlKey];
        (htmlAsset as OutputAsset).fileName = "index.html";
        bundle["index.html"] = htmlAsset as OutputAsset;
      }

      // Step 3: Copy manifest.json to the dist folder
      const manifestPath = resolve(__dirname, "src/manifest.json");
      const manifestSource = readFileSync(manifestPath, "utf-8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: manifestSource,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    ui3InlineSvg(), // Handle SVG imports from UI3 Kit
    svelte(), // Compile Svelte components
    inlineFigmaHtml(), // Inline everything into single HTML file
  ],
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clear dist/ (manifest.json gets copied here)
    target: "es2017", // Figma's JS sandbox doesn't support ES2020+ (no ?. or ??)
    rollupOptions: {
      input: {
        ui: resolve(__dirname, "src/index.html"), // UI entry point
        code: resolve(__dirname, "src/code.ts"), // Plugin code entry point
      },
      output: {
        // Use clean filenames instead of hashed names
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "code" ? "code.js" : "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
});
