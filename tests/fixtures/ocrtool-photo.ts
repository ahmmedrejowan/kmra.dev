/**
 * Generated inputs for the OCR photo engine tests (called from make.ts), drawn on a canvas in
 * Chromium with known text:
 *
 *   ocr-screenshot.png  a 1280×800 app screenshot: dark nav bar, coloured buttons with white
 *                       labels, small grey captions, a dark-mode panel (SCREENSHOT_TEXT)
 *   ocr-page-photo.jpg  a "phone photo" of a printed page: rotated ~5°, perspective-warped onto a
 *                       wooden-ish table, uneven light, slight blur and noise, JPEG (PAGE_TEXT)
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

/** Every piece of text drawn on the screenshot, as [text, x, y, size, colour, weight?] */
const SHOT: [string, number, number, number, string, number?][] = [
  // Nav bar
  ["Northwind Studio", 32, 40, 20, "#ffffff", 700],
  ["Dashboard", 420, 40, 15, "#c7d2fe"],
  ["Projects", 530, 40, 15, "#c7d2fe"],
  ["Invoices", 630, 40, 15, "#c7d2fe"],
  ["Settings", 730, 40, 15, "#c7d2fe"],
  // Main card
  ["Quarterly report for October", 48, 130, 26, "#111827", 700],
  ["Last edited 3 minutes ago by Maria Lopez", 48, 162, 12, "#6b7280"],
  [
    "Revenue grew steadily across every region this quarter.",
    48,
    210,
    15,
    "#1f2937",
  ],
  [
    "Shipping delays in March were resolved by the new warehouse team.",
    48,
    236,
    15,
    "#1f2937",
  ],
  [
    "Customer support answered most tickets within two hours.",
    48,
    262,
    15,
    "#1f2937",
  ],
  // Buttons (labels drawn on coloured pills below)
  ["Save changes", 72, 336, 15, "#ffffff", 600],
  ["Publish now", 262, 336, 15, "#ffffff", 600],
  ["Delete project", 442, 336, 15, "#ffffff", 600],
  ["Cancel", 648, 336, 15, "#374151", 600],
  // Small grey footnotes
  [
    "Changes are saved automatically every few seconds.",
    48,
    400,
    12,
    "#9ca3af",
  ],
  ["Version 4.2.1 build 7730", 48, 420, 11, "#9ca3af"],
  // Dark mode panel
  ["Dark mode preview", 800, 130, 18, "#f9fafb", 700],
  ["Notifications are turned off", 800, 170, 14, "#d1d5db"],
  ["Battery saver keeps running", 800, 200, 14, "#d1d5db"],
  ["Updated yesterday at 9:41", 800, 236, 12, "#9ca3af"],
  ["Open terminal", 820, 296, 14, "#0b0f19", 600],
  // Status chips
  ["Paid", 66, 498, 13, "#065f46", 600],
  ["Overdue", 166, 498, 13, "#991b1b", 600],
  ["Draft", 286, 498, 13, "#92400e", 600],
  // Table
  ["Customer", 48, 560, 13, "#6b7280", 600],
  ["Amount", 360, 560, 13, "#6b7280", 600],
  ["Status", 560, 560, 13, "#6b7280", 600],
  ["Blue Harbor Trading", 48, 596, 14, "#111827"],
  ["1,250.00", 360, 596, 14, "#111827"],
  ["Paid", 560, 596, 14, "#111827"],
  ["Green Valley Farms", 48, 628, 14, "#111827"],
  ["980.40", 360, 628, 14, "#111827"],
  ["Pending", 560, 628, 14, "#111827"],
];

export const SCREENSHOT_TEXT = SHOT.map((s) => s[0]).join("\n");

const PAGE_LINES = [
  "The Lighthouse Keeper",
  "",
  "Every evening the keeper climbed the narrow stairs",
  "to light the great lamp above the harbour. Ships",
  "far out at sea would see the beam and turn safely",
  "away from the rocks hidden below the waves.",
  "",
  "In winter the storms were fierce and the wind",
  "rattled the windows of the small stone cottage.",
  "Still the keeper kept the light burning until",
  "morning, writing each night in a worn notebook.",
  "",
  "Page 12 of 48",
];
export const PAGE_TEXT = PAGE_LINES.filter(Boolean).join("\n");

export async function makeOcrPhotoFixtures(dir: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const shot = await page.evaluate((items) => {
      const c = document.createElement("canvas");
      c.width = 1280;
      c.height = 800;
      const g = c.getContext("2d")!;
      g.fillStyle = "#f3f4f6";
      g.fillRect(0, 0, 1280, 800);
      // Nav bar
      g.fillStyle = "#312e81";
      g.fillRect(0, 0, 1280, 72);
      // Main card
      g.fillStyle = "#ffffff";
      g.fillRect(24, 92, 728, 360);
      // Buttons
      const pill = (x: number, w: number, fill: string, stroke?: string) => {
        g.fillStyle = fill;
        g.beginPath();
        g.roundRect(x, 312, w, 40, 8);
        g.fill();
        if (stroke) {
          g.strokeStyle = stroke;
          g.stroke();
        }
      };
      pill(48, 160, "#2563eb");
      pill(240, 150, "#16a34a");
      pill(420, 170, "#dc2626");
      pill(624, 104, "#ffffff", "#d1d5db");
      // Dark panel
      g.fillStyle = "#111827";
      g.beginPath();
      g.roundRect(776, 92, 480, 240, 12);
      g.fill();
      g.fillStyle = "#a5b4fc";
      g.beginPath();
      g.roundRect(800, 272, 150, 36, 8);
      g.fill();
      // Chips
      const chip = (x: number, w: number, fill: string) => {
        g.fillStyle = fill;
        g.beginPath();
        g.roundRect(x, 478, w, 28, 14);
        g.fill();
      };
      chip(48, 72, "#d1fae5");
      chip(148, 96, "#fee2e2");
      chip(268, 72, "#fef3c7");
      // Table lines
      g.fillStyle = "#e5e7eb";
      for (const y of [572, 608, 640]) g.fillRect(48, y, 640, 1);
      g.textBaseline = "middle";
      for (const [text, x, y, size, colour, weight] of items) {
        g.font = `${weight ?? 400} ${size}px Arial, Helvetica, sans-serif`;
        g.fillStyle = colour;
        g.fillText(text, x, y);
      }
      return c.toDataURL("image/png").split(",")[1]!;
    }, SHOT);
    await writeFile(
      join(dir, "ocr-screenshot.png"),
      Buffer.from(shot, "base64"),
    );

    const photo = await page.evaluate((lines) => {
      // The page itself, flat
      const pw = 1100;
      const ph = 1400;
      const pc = document.createElement("canvas");
      pc.width = pw;
      pc.height = ph;
      const p = pc.getContext("2d")!;
      p.fillStyle = "#f7f4ec";
      p.fillRect(0, 0, pw, ph);
      p.fillStyle = "#1c1c1c";
      p.textBaseline = "alphabetic";
      let y = 150;
      lines.forEach((line, i) => {
        if (!line) {
          y += 30;
          return;
        }
        p.font =
          i === 0
            ? "bold 48px Georgia, 'Times New Roman', serif"
            : "34px Georgia, 'Times New Roman', serif";
        p.fillText(line, 90, y);
        y += i === 0 ? 80 : 54;
      });
      const src = p.getImageData(0, 0, pw, ph).data;

      // The photo: the page lies rotated ~5° and seen at a slant (perspective), on a table
      const W = 1600;
      const H = 1200;
      // Page corners in the photo (clockwise from top-left)
      const rot = (5 * Math.PI) / 180;
      const cx = W / 2;
      const cy = H / 2;
      const base: [number, number][] = [
        [-430, -560],
        [430, -560],
        [500, 560],
        [-500, 560],
      ];
      const dst = base.map(([x, y2]) => [
        cx + x * Math.cos(rot) - y2 * Math.sin(rot) * 0.98,
        cy + x * Math.sin(rot) + y2 * Math.cos(rot) * 0.98,
      ]);
      // Homography from photo → page (inverse mapping)
      const from = dst;
      const to = [
        [0, 0],
        [pw, 0],
        [pw, ph],
        [0, ph],
      ];
      const A: number[][] = [];
      for (let k = 0; k < 4; k++) {
        const [x, y2] = from[k]!;
        const [u, v] = to[k]!;
        A.push([x!, y2!, 1, 0, 0, 0, -u! * x!, -u! * y2!, u!]);
        A.push([0, 0, 0, x!, y2!, 1, -v! * x!, -v! * y2!, v!]);
      }
      // Gaussian elimination
      for (let col = 0; col < 8; col++) {
        let piv = col;
        for (let r = col + 1; r < 8; r++)
          if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
        [A[col], A[piv]] = [A[piv]!, A[col]!];
        for (let r = 0; r < 8; r++) {
          if (r === col) continue;
          const f = A[r]![col]! / A[col]![col]!;
          for (let k = col; k < 9; k++) A[r]![k]! -= f * A[col]![k]!;
        }
      }
      const h = A.map((r, i) => r[8]! / r[i]!);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d")!;
      const out = g.createImageData(W, H);
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let yy = 0; yy < H; yy++)
        for (let xx = 0; xx < W; xx++) {
          const den = h[6]! * xx + h[7]! * yy + 1;
          const u = (h[0]! * xx + h[1]! * yy + h[2]!) / den;
          const v = (h[3]! * xx + h[4]! * yy + h[5]!) / den;
          const o = (yy * W + xx) * 4;
          // Light falls off toward the bottom right
          const light = 1 - 0.28 * ((xx / W) * 0.6 + (yy / H) * 0.4);
          let r: number;
          let gg: number;
          let b: number;
          if (u >= 0 && v >= 0 && u < pw - 1 && v < ph - 1) {
            // Bilinear sample of the page
            const x0 = Math.floor(u);
            const y0 = Math.floor(v);
            const fx = u - x0;
            const fy = v - y0;
            const at = (X: number, Y: number, ch: number) =>
              src[(Y * pw + X) * 4 + ch]!;
            const s = (ch: number) =>
              at(x0, y0, ch) * (1 - fx) * (1 - fy) +
              at(x0 + 1, y0, ch) * fx * (1 - fy) +
              at(x0, y0 + 1, ch) * (1 - fx) * fy +
              at(x0 + 1, y0 + 1, ch) * fx * fy;
            r = s(0);
            gg = s(1);
            b = s(2);
          } else {
            // Table: brown with grain
            const grain = Math.sin(yy * 0.05 + Math.sin(xx * 0.01) * 3) * 12;
            r = 120 + grain;
            gg = 82 + grain * 0.7;
            b = 52 + grain * 0.4;
          }
          const n = (rnd() - 0.5) * 18;
          out.data[o] = r * light + n;
          out.data[o + 1] = gg * light + n;
          out.data[o + 2] = b * light + n;
          out.data[o + 3] = 255;
        }
      g.putImageData(out, 0, 0);
      // Slight focus blur
      const blur = document.createElement("canvas");
      blur.width = W;
      blur.height = H;
      const bg = blur.getContext("2d")!;
      bg.filter = "blur(1.2px)";
      bg.drawImage(c, 0, 0);
      return blur.toDataURL("image/jpeg", 0.8).split(",")[1]!;
    }, PAGE_LINES);
    await writeFile(
      join(dir, "ocr-page-photo.jpg"),
      Buffer.from(photo, "base64"),
    );
  } finally {
    await browser.close();
  }
}

/** Words of a text, lower-cased, without punctuation at the edges */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

/** Share of the expected words (with repeats) found in the OCR text */
export function wordRecall(expected: string, got: string): number {
  const want = wordsOf(expected);
  const have = new Map<string, number>();
  for (const w of wordsOf(got)) have.set(w, (have.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of want) {
    const n = have.get(w) ?? 0;
    if (n > 0) {
      hit++;
      have.set(w, n - 1);
    }
  }
  return want.length ? hit / want.length : 1;
}
