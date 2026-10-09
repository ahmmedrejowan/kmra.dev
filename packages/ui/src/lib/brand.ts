/**
 * Logo marks, drawn as SVG on a 64×64 grid so the same drawing is used for the header,
 * favicons, app icons and OG images.
 */
export function markInner(appId: string): string {
  switch (appId) {
    case "imgtool":
      // A photo: sun over two hills
      return `<circle cx="42" cy="22" r="6" fill="#fff"/><path d="M12 47 26 29l9 11 6-7 11 14z" fill="#fff"/>`;
    case "pdftool":
      // A page with a folded corner and text lines
      return `<path d="M20 12h17l10 10v30H20z" fill="#fff"/><path d="M37 12v10h10" fill="none" stroke-opacity=".35" stroke="#000" stroke-width="2"/><path d="M26 32h15M26 38h15M26 44h10" stroke="#e5484d" stroke-width="3" stroke-linecap="round"/>`;
    case "qrtool":
      // Three QR finder squares and a few modules
      return `<g fill="#fff"><path fill-rule="evenodd" d="M13 13h14v14H13zM16.5 16.5v7h7v-7zM37 13h14v14H37zM40.5 16.5v7h7v-7zM13 37h14v14H13zM16.5 40.5v7h7v-7z"/><rect x="19" y="19" width="2" height="2"/><rect x="43" y="19" width="2" height="2"/><rect x="19" y="43" width="2" height="2"/><rect x="37" y="37" width="5" height="5" rx="1"/><rect x="46" y="37" width="5" height="5" rx="1"/><rect x="37" y="46" width="5" height="5" rx="1"/><rect x="46" y="46" width="5" height="5" rx="1"/><rect x="41.5" y="41.5" width="5" height="5" rx="1"/></g>`;
    case "ocrtool":
      // A scan frame with text lines inside
      return `<path d="M14 22v-5a3 3 0 0 1 3-3h5M42 14h5a3 3 0 0 1 3 3v5M50 42v5a3 3 0 0 1-3 3h-5M22 50h-5a3 3 0 0 1-3-3v-5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M23 27h18M23 33h18M23 39h11" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
    case "kmra": {
      // The hub: one square per app, in its colour (two rows of three)
      const colors = ["#0057ff", "#e5484d", "#12a594", "#8e4ec6", "#f76b15", "#30a46c"];
      return colors
        .map(
          (c, i) =>
            `<rect x="${12 + (i % 3) * 14.5}" y="${18 + Math.floor(i / 3) * 14.5}" width="11" height="11" rx="3" fill="${c}"/>`,
        )
        .join("");
    }
    case "devtool":
      // A terminal prompt and cursor: "> _"
      return `<path d="M17 22 27 32 17 42" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="31" y="39" width="17" height="5" rx="2.5" fill="#fff"/>`;
    default:
      return `<text x="32" y="43" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${appId.slice(0, 1).toUpperCase()}</text>`;
  }
}

/** Full mark: accent rounded square with the app's glyph. `pad` shrinks it for maskable icons. */
export function markSvg(
  appId: string,
  color: string,
  opts: { size?: number; rounded?: boolean; pad?: number } = {},
): string {
  const { size = 64, rounded = true, pad = 0 } = opts;
  const scale = (64 - pad * 2) / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rounded ? 15 : 0}" fill="${color}"/><g transform="translate(${pad} ${pad}) scale(${scale})">${markInner(appId)}</g></svg>`;
}
