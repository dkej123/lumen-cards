import { injectFonts } from "../src/design/fonts";

// Standalone entries (dev/index.html): the same @font-face rules as in the HA
// build, with the files resolved by Vite from the @fontsource packages.
// Only the files in FONT_FILES (latin + latin-ext of the weights in use).
const files = import.meta.glob<string>(
  [
    "../node_modules/@fontsource-variable/manrope/files/manrope-latin{,-ext}-wght-normal.woff2",
    "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin{,-ext}-{400,500}-normal.woff2",
  ],
  { eager: true, query: "?url", import: "default" },
);
const byName = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1), url]));

export const injectLocalFonts = () => injectFonts((file) => byName.get(file) ?? file);
