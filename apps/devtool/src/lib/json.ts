/**
 * A JSON.parse error as a line, column and plain message (English; callers translate it).
 * V8 reports "… at position 42 (line 3 column 7)"; other engines differ, so the position is
 * found from whatever the message has.
 */
export function jsonError(
  text: string,
  e: unknown,
): { message: string; line?: number; col?: number } {
  const raw = e instanceof Error ? e.message : String(e);
  let line: number | undefined;
  let col: number | undefined;
  const lc = /line (\d+) column (\d+)/i.exec(raw);
  const pos = /position (\d+)/i.exec(raw);
  if (lc) {
    line = +lc[1]!;
    col = +lc[2]!;
  } else if (pos) {
    const before = text.slice(0, +pos[1]!);
    line = before.split("\n").length;
    col = before.length - before.lastIndexOf("\n");
  }
  return { message: hint(raw, text), line, col };
}

/** The usual causes, in plain words */
function hint(raw: string, text: string): string {
  if (/Unexpected end/i.test(raw))
    return "The JSON ends too early. A bracket or quote isn't closed.";
  if (
    /trailing comma|Expected double-quoted property name/i.test(raw) &&
    /,\s*[}\]]/.test(text)
  )
    return "There's a comma before a closing bracket. Remove the trailing comma.";
  if (/'/.test(text) && /Unexpected token '?'/i.test(raw))
    return "JSON needs double quotes, not single quotes.";
  if (/property name/i.test(raw)) return "Keys must be in double quotes.";
  if (/Bad control character/i.test(raw))
    return "A string has a raw line break or tab. Use \\n or \\t instead.";
  return "This isn't valid JSON. Check the marked line.";
}
