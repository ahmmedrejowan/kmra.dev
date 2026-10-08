/**
 * Guess what pasted text is, so the home page can open the right tool. Ordered from the most
 * specific shapes to the loosest; returns the tool slug and a short label, or null.
 */
export interface Guess {
  slug: string;
  label: string;
}

const B64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

function printable(s: string) {
  return !/[\x00-\x08\x0e-\x1f]/.test(s);
}

export function detect(input: string): Guess | null {
  const t = input.trim();
  if (!t) return null;

  if (/^curl\s/i.test(t))
    return { slug: "curl-converter", label: "cURL command" };
  if (/^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(t))
    return { slug: "jwt-decoder", label: "JWT" };
  if (/^[{[]/.test(t)) {
    try {
      JSON.parse(t);
      return { slug: "json-formatter", label: "JSON" };
    } catch {
      return { slug: "json-formatter", label: "JSON (with an error)" };
    }
  }
  if (/^\d{10}(\d{3})?$/.test(t))
    return { slug: "timestamp", label: "Unix timestamp" };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t))
    return { slug: "uuid", label: "UUID" };
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(t))
    return { slug: "color-converter", label: "Color" };
  if (
    /^(\S+\s+){4}\S+$/.test(t) &&
    /^[\d*/,\-?LW#A-Z]+(\s+[\d*/,\-?LW#A-Z]+){4}$/i.test(t)
  )
    return { slug: "cron-explainer", label: "Cron expression" };
  if (/^[0-7]{3,4}$/.test(t))
    return { slug: "chmod-calculator", label: "File permissions" };
  if (/^https?:\/\/\S+$/i.test(t))
    return /%[0-9a-f]{2}/i.test(t)
      ? { slug: "url-encode", label: "Encoded URL" }
      : { slug: "url-parser", label: "URL" };
  if (/%[0-9a-f]{2}/i.test(t) && !/\s/.test(t))
    return { slug: "url-encode", label: "Encoded text" };
  if (/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(t))
    return { slug: "html-entities", label: "HTML entities" };
  if (/^\s*(select|insert|update|delete|create|with)\s/i.test(t))
    return { slug: "sql-formatter", label: "SQL" };
  if (/^\s*<(!doctype html|html|div|body|head|span|p)\b/i.test(t))
    return { slug: "html-formatter", label: "HTML" };
  if (/^\s*<\?xml|^\s*<[\w:-]+[\s>]/.test(t))
    return { slug: "xml-formatter", label: "XML" };
  if (t.length >= 16 && t.length % 4 === 0 && B64.test(t.replace(/\s+/g, ""))) {
    try {
      const s = atob(
        t.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"),
      );
      if (printable(s)) return { slug: "base64", label: "Base64" };
    } catch {}
  }
  if (/^[\w"-]+(,[^\n]*)+\n[^\n]*,/.test(t))
    return { slug: "csv-json", label: "CSV" };
  if (/^[\w-]+:\s.+$/m.test(t) && /\n/.test(t) && !/[{};]/.test(t))
    return { slug: "yaml-json", label: "YAML" };
  if (/^#{1,6}\s|\*\*\S|^\s*[-*]\s\S/m.test(t))
    return { slug: "markdown-preview", label: "Markdown" };
  return null;
}
