/**
 * Runs a regular expression off the main thread. A pattern with catastrophic backtracking
 * can't be interrupted from inside, so the page terminates this worker after a time limit.
 */
import type { RegexJob, RegexResult, RxMatch } from "./regex";

const MAX_MATCHES = 5000;

self.onmessage = (e: MessageEvent<RegexJob>) => {
  const { id, pattern, flags, text, replace } = e.data;
  const t0 = performance.now();
  try {
    const re = new RegExp(pattern, flags);
    const all = re.global || re.sticky;
    const matches: RxMatch[] = [];
    let capped = false;
    re.lastIndex = 0;
    for (;;) {
      const m = re.exec(text);
      if (!m) break;
      const ind = (m as RegExpExecArray & { indices?: [number, number][] })
        .indices;
      matches.push({
        index: m.index,
        end: m.index + m[0].length,
        text: m[0],
        groups: m.slice(1).map((v, i) => ({
          n: i + 1,
          value: v,
          span: ind?.[i + 1],
        })),
        named: m.groups
          ? Object.entries(m.groups).map(([name, value]) => ({ name, value }))
          : [],
      });
      if (!all) break;
      if (matches.length >= MAX_MATCHES) {
        capped = true;
        break;
      }
      // An empty match would repeat forever; step past it
      if (m[0].length === 0) {
        const unicode = /[uv]/.test(flags);
        const cp = unicode ? text.codePointAt(re.lastIndex) : undefined;
        re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1;
      }
    }
    const replaced =
      replace === null
        ? null
        : text.replace(new RegExp(pattern, flags), replace);
    const out: RegexResult = {
      id,
      ok: true,
      matches,
      capped,
      replaced,
      ms: performance.now() - t0,
    };
    postMessage(out);
  } catch (err) {
    const out: RegexResult = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    postMessage(out);
  }
};
