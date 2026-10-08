/**
 * Text handed from one page to another (the home page's smart paste box to a tool). Kept in
 * sessionStorage for this tab only and removed when the tool takes it.
 */
const KEY = "kmra-dev-handoff";

export function giveText(slug: string, text: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ slug, text }));
  } catch {}
}

/** The handed-over text for this tool, once; null if there's none. */
export function takeText(slug: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { slug: string; text: string };
    if (v.slug !== slug) return null;
    sessionStorage.removeItem(KEY);
    return v.text;
  } catch {
    return null;
  }
}
