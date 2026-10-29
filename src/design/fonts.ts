// Self-hosted Manrope (variable 300–800) and IBM Plex Mono 400/500, latin +
// latin-ext (Polish). The files sit flat next to the bundle (copied by
// vite.config.ts; HACS only installs files directly in dist/). @font-face does not work inside shadow
// roots, so the rules go to the document once.

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

export const FONT_FILES = [
  "manrope-latin-wght-normal.woff2",
  "manrope-latin-ext-wght-normal.woff2",
  "ibm-plex-mono-latin-400-normal.woff2",
  "ibm-plex-mono-latin-ext-400-normal.woff2",
  "ibm-plex-mono-latin-500-normal.woff2",
  "ibm-plex-mono-latin-ext-500-normal.woff2",
];

/** `base`: directory holding the fonts (HA build), or a file → URL map (Vite dev, standalone entries). */
export function injectFonts(base: string | ((file: string) => string)): void {
  if (document.getElementById("lumen-cards-fonts")) return;
  const url = typeof base === "string" ? (file: string) => `${base}${file}` : base;
  const face = (family: string, file: string, weight: string, range: string, format = "woff2") =>
    `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};` +
    `src:url(${url(file)}) format('${format}');unicode-range:${range}}`;
  const style = document.createElement("style");
  style.id = "lumen-cards-fonts";
  style.textContent = [
    face("Manrope", FONT_FILES[0], "200 800", LATIN, "woff2-variations"),
    face("Manrope", FONT_FILES[1], "200 800", LATIN_EXT, "woff2-variations"),
    face("IBM Plex Mono", FONT_FILES[2], "400", LATIN),
    face("IBM Plex Mono", FONT_FILES[3], "400", LATIN_EXT),
    face("IBM Plex Mono", FONT_FILES[4], "500", LATIN),
    face("IBM Plex Mono", FONT_FILES[5], "500", LATIN_EXT),
  ].join("\n");
  document.head.append(style);
}
