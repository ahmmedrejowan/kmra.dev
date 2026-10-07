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
