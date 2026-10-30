import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// The catalog page module (dev/catalog.ts): Lumen + the demo home + the catalog, one ES file.
//   npx vite build --config vite.catalog.config.ts --outDir <dir>   (copy dist/*.woff2 next to it)
const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"));

export default defineConfig({
  define: { __LUMEN_VERSION__: JSON.stringify(version) },
  build: {
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    lib: { entry: resolve(import.meta.dirname, "dev/catalog.ts"), formats: ["es"], fileName: () => "catalog.js" },
    rollupOptions: { output: { codeSplitting: false } },
  },
});
