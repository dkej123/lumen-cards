import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// The Demo tab's module (dev/home-demo.ts), next to the catalog's: run after it, into the same folder.
//   npx vite build --config vite.demo.config.ts --outDir <dir>
const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"));

export default defineConfig({
  define: { __LUMEN_VERSION__: JSON.stringify(version) },
  build: {
    emptyOutDir: false,
    target: "es2022",
    minify: true,
    lib: { entry: resolve(import.meta.dirname, "dev/home-demo.ts"), formats: ["es"], fileName: () => "home-demo.js" },
    rollupOptions: { output: { codeSplitting: false } },
  },
});
