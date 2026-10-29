import { copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import { FONT_FILES } from "./src/design/fonts";

const outDir = resolve(import.meta.dirname, "dist");

const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"));

/**
 * Self-hosted fonts sit flat next to the bundle (/hacsfiles/lumen-cards/<font>.woff2): HACS
 * downloads only the files directly in dist/, not subfolders (src/design/fonts.ts).
 */
const copyFonts = (): Plugin => ({
  name: "lumen-copy-fonts",
  apply: "build",
  writeBundle() {
    for (const file of FONT_FILES) {
      const pkg = file.startsWith("manrope") ? "@fontsource-variable/manrope" : "@fontsource/ibm-plex-mono";
      copyFileSync(resolve(import.meta.dirname, "node_modules", pkg, "files", file), resolve(outDir, file));
    }
  },
});

// `npm run build` emits dist/lumen-cards.js (the file HACS installs, committed like
// other dashboard repos) plus the fonts. `npm run dev` serves dev/index.html.
export default defineConfig({
  plugins: [copyFonts()],
  define: { __LUMEN_VERSION__: JSON.stringify(version) },
  server: { port: 5174, host: true },
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/lumen-cards.ts"),
      formats: ["es"],
      fileName: () => "lumen-cards.js",
    },
    rollupOptions: { output: { codeSplitting: false, minify: true } },
  },
  test: { environment: "node" },
});
