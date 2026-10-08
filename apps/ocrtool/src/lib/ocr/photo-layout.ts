/**
 * Photo engine geometry and layout: rotated text boxes, word boxes from the recogniser's
 * character positions, reading order (XY-cut) and paragraphs. Pure functions, used by the
 * photo worker (geometry) and photo.ts (layout, which is cheap).
 */
import type { Box, Line, Word } from "./types";

export interface Pt {
  x: number;
  y: number;
}

/** A text box: corners in the source image in reading order (top-left, top-right, bottom-right, bottom-left) */
export type Quad = [Pt, Pt, Pt, Pt];

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Axis-aligned box around points, clamped to the image */
export function bbox(pts: Pt[], W: number, H: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(W, Math.ceil(x1));
  y1 = Math.min(H, Math.ceil(y1));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** What the recogniser read in one strip */
export interface Read {
  text: string;
  /** Mean character probability, 0–100 */
  conf: number;
  /** Each character, where it was read along the strip (0–1) and its probability (0–1) */
  chars: { ch: string; at: number; p: number }[];
}

/** One read box placed on the page */
export interface Seg extends Read {
  quad: Quad;
  /** Centre along / across the page's reading direction (deskewed) */
  u: number;
  v: number;
  /** Box height and length */
  h: number;
  len: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
};

/** Place reads on the page, deskewed by the median angle of the long boxes */
export function segments(reads: (Read & { quad: Quad })[]): Seg[] {
  const angles = reads
    .filter((b) => dist(b.quad[0], b.quad[1]) > 2 * dist(b.quad[0], b.quad[3]))
    .map((b) =>
      Math.atan2(b.quad[1].y - b.quad[0].y, b.quad[1].x - b.quad[0].x),
    );
  const ang = median(angles);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  return reads.map((b) => {
    const cx = (b.quad[0].x + b.quad[2].x) / 2;
    const cy = (b.quad[0].y + b.quad[2].y) / 2;
    return {
      ...b,
      u: cx * ca + cy * sa,
      v: -cx * sa + cy * ca,
      h: dist(b.quad[0], b.quad[3]),
      len: dist(b.quad[0], b.quad[1]),
    };
  });
}

/** Word boxes from where each character was read along the strip */
function words(seg: Seg, W: number, H: number): Word[] {
  const q = seg.quad;
  const out: Word[] = [];
  const cs = seg.chars;
  const step =
    cs.length > 1 ? (cs[cs.length - 1]!.at - cs[0]!.at) / (cs.length - 1) : 1;
  let i = 0;
  while (i < cs.length) {
    while (i < cs.length && cs[i]!.ch === " ") i++;
    if (i >= cs.length) break;
    let j = i;
    while (j + 1 < cs.length && cs[j + 1]!.ch !== " ") j++;
    // Edges: a little past the first and last character, never past the spaces around
    const before = i > 0 ? cs[i - 1]!.at : 0;
    const after = j + 1 < cs.length ? cs[j + 1]!.at : 1;
    const f0 = i === 0 ? 0 : Math.max(before, cs[i]!.at - step * 0.7);
    const f1 =
      j === cs.length - 1 ? 1 : Math.min(after, cs[j]!.at + step * 0.7);
    out.push({
      text: cs
        .slice(i, j + 1)
        .map((c) => c.ch)
        .join(""),
      confidence: Math.round(
        (cs.slice(i, j + 1).reduce((n, c) => n + c.p, 0) / (j + 1 - i)) * 100,
      ),
      box: bbox(
        [
          lerp(q[0], q[1], f0),
          lerp(q[0], q[1], f1),
          lerp(q[3], q[2], f0),
          lerp(q[3], q[2], f1),
        ],
        W,
        H,
      ),
    });
    i = j + 1;
  }
  return out;
}

/** Gaps between merged [lo, hi] intervals */
function gaps(iv: [number, number][]): [number, number][] {
  const s = [...iv].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let end = s[0]![1];
  for (const [lo, hi] of s.slice(1)) {
    if (lo > end) out.push([end, lo]);
    end = Math.max(end, hi);
  }
  return out;
}

/** Share of `a` with a segment of `b` on the same row */
function aligned(a: Seg[], b: Seg[]) {
  let n = 0;
  for (const s of a)
    if (b.some((t) => Math.abs(t.v - s.v) < 0.3 * Math.min(s.h, t.h))) n++;
  return n / a.length;
}

/** Number of distinct rows */
function rowCount(segs: Seg[]) {
  return gaps(segs.map((s) => [s.v - 0.3 * s.h, s.v + 0.3 * s.h])).length + 1;
}

/**
 * Reading order by recursive XY-cut: split between rows, and at wide gutters between columns
 * or side panels (each side at least two rows) unless both sides line up row by row, which is
 * a table and is read across. Each leaf is one row, left to right.
 */
function xyCut(segs: Seg[], h: number, out: Seg[][]) {
  if (segs.length <= 1) {
    if (segs.length) out.push(segs);
    return;
  }
  // Rows use the middle of each box (boxes of neighbouring lines may touch)
  const yg = gaps(segs.map((s) => [s.v - 0.3 * s.h, s.v + 0.3 * s.h]));
  const xg = gaps(segs.map((s) => [s.u - s.len / 2, s.u + s.len / 2]));
  let bestY: [number, number] | null = null;
  for (const g of yg)
    if (!bestY || g[1] - g[0] > bestY[1] - bestY[0]) bestY = g;
  for (const g of [...xg].sort((p, q) => q[1] - q[0] - (p[1] - p[0]))) {
    const width = g[1] - g[0];
    if (width < 2 * h) break;
    if (bestY && bestY[1] - bestY[0] >= width) break;
    const cut = (g[0] + g[1]) / 2;
    const left = segs.filter((s) => s.u < cut);
    const right = segs.filter((s) => s.u >= cut);
    if (rowCount(left) < 2 || rowCount(right) < 2) continue;
    if (aligned(left, right) >= 0.6 && aligned(right, left) >= 0.6) continue;
    xyCut(left, h, out);
    xyCut(right, h, out);
    return;
  }
  if (bestY) {
    const cut = (bestY[0] + bestY[1]) / 2;
    xyCut(
      segs.filter((s) => s.v < cut),
      h,
      out,
    );
    xyCut(
      segs.filter((s) => s.v >= cut),
      h,
      out,
    );
    return;
  }
  out.push([...segs].sort((a, b) => a.u - b.u));
}

/** Lines in reading order and the plain text, with blank lines between paragraphs */
export function layout(
  segs: Seg[],
  W: number,
  H: number,
): { lines: Line[]; text: string } {
  if (!segs.length) return { lines: [], text: "" };
  const rows: Seg[][] = [];
  xyCut(segs, median(segs.map((s) => s.h)), rows);
  const lines: (Line & { v: number; h: number })[] = [];
  for (const row of rows) {
    // A row is one line unless its parts are far apart (UI items, table cells)
    let group: Seg[] = [];
    const flush = () => {
      if (!group.length) return;
      const chars = group.reduce((n, g) => n + g.text.length, 0);
      lines.push({
        text: group.map((g) => g.text.trim()).join(" "),
        confidence: Math.round(
          group.reduce((n, g) => n + g.conf * g.text.length, 0) /
            Math.max(1, chars),
        ),
        words: group.flatMap((g) => words(g, W, H)),
        box: bbox(
          group.flatMap((g) => g.quad),
          W,
          H,
        ),
        v: group.reduce((n, g) => n + g.v, 0) / group.length,
        h: Math.max(...group.map((g) => g.h)),
      });
      group = [];
    };
    for (const s of row) {
      const prev = group.at(-1);
      const gap = s.u - s.len / 2 - (prev ? prev.u + prev.len / 2 : 0);
      if (prev && gap > 2.5 * Math.max(s.h, prev.h)) flush();
      group.push(s);
    }
    flush();
  }
  // Paragraphs: a blank line where the space above is clearly more than between lines, or
  // where reading moves back up (the next column)
  const gapOf = (a: { v: number; h: number }, b: { v: number; h: number }) =>
    b.v - b.h / 2 - (a.v + a.h / 2);
  const usual = median(
    lines
      .slice(1)
      .map((l, i) => gapOf(lines[i]!, l))
      .filter((g) => g >= 0),
  );
  let text = "";
  lines.forEach((l, i) => {
    if (i > 0) {
      const p = lines[i - 1]!;
      const hh = Math.min(l.h, p.h);
      const sameRow = Math.abs(l.v - p.v) < 0.5 * hh;
      const gap = gapOf(p, l);
      const para = !sameRow && (gap > usual + 0.4 * hh || l.v < p.v - hh);
      text += para ? "\n\n" : "\n";
    }
    text += l.text;
  });
  return {
    lines: lines.map(({ v: _v, h: _h, ...l }) => l),
    text,
  };
}
