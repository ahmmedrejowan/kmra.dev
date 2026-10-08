/**
 * Generated inputs for the OCRTool image tests (called from make.ts), drawn on a canvas in
 * Chromium with known text:
 *
 *   ocr-doc.png      a plain document: dark serif text on white (DOC_LINES)
 *   ocr-ui.png       a screenshot-style UI snippet at 1× scale: a coloured header, a card with
 *                    small grey text and a coloured button (UI_LINES)
 *   ocr-note.png     a short note, for batches (NOTE_LINES)
 *   ocr-chinese.png  one Simplified Chinese line (CHINESE), only written when a system font can
 *                    draw it (tests skip without it)
 */
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

export const DOC_LINES = [
  "Dear customer, thank you for your order.",
  "Your parcel will arrive within five working days.",
  "Please keep this letter for your records.",
  "Questions about delivery can be sent by email.",
];

export const UI_LINES = [
  "Account settings",
  "Notifications are turned on for this device",
  "Weekly summary emails arrive every Monday",
  "Save changes",
];

export const NOTE_LINES = [
  "Meeting moved to Thursday afternoon.",
  "Bring the printed agenda.",
];

export const CHINESE = "今天天气很好我们去公园散步";

type Draw =
  | { kind: "doc"; lines: string[] }
  | { kind: "ui"; lines: string[] }
  | { kind: "zh"; text: string };

export async function makeOcrImageFixtures(dir: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const draw = (d: Draw) =>
      page.evaluate((d) => {
        const c = document.createElement("canvas");
        const x = c.getContext("2d")!;
        if (d.kind === "doc") {
          c.width = 1500;
          c.height = 120 + d.lines.length * 80;
          x.fillStyle = "#ffffff";
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#111111";
          x.font = "40px Georgia, 'Times New Roman', serif";
          d.lines.forEach((l, i) => x.fillText(l, 70, 100 + i * 80));
        } else if (d.kind === "ui") {
          // 1× screenshot: 15–20 px text on coloured surfaces
          c.width = 760;
          c.height = 300;
          x.fillStyle = "#f3f4f6";
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#4338ca";
          x.fillRect(0, 0, c.width, 56);
          x.fillStyle = "#ffffff";
          x.font = "bold 20px Arial, Helvetica, sans-serif";
          x.fillText(d.lines[0]!, 24, 36);
          x.fillStyle = "#ffffff";
          x.fillRect(24, 80, 712, 140);
          x.fillStyle = "#1f2937";
          x.font = "17px Arial, Helvetica, sans-serif";
          x.fillText(d.lines[1]!, 44, 124);
          x.fillStyle = "#6b7280";
          x.font = "15px Arial, Helvetica, sans-serif";
          x.fillText(d.lines[2]!, 44, 160);
          x.fillStyle = "#16a34a";
          x.beginPath();
          x.roundRect(24, 238, 150, 42, 8);
          x.fill();
          x.fillStyle = "#ffffff";
          x.font = "bold 16px Arial, Helvetica, sans-serif";
          x.fillText(d.lines[3]!, 48, 265);
        } else {
          c.width = 1100;
          c.height = 160;
          x.fillStyle = "#ffffff";
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = "#111111";
          const font =
            "48px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', sans-serif";
          // No CJK font: the characters draw the same as an unassigned code point (a box or nothing)
          const probe = (s: string) => {
            const p = document.createElement("canvas");
            p.width = 60;
            p.height = 60;
            const q = p.getContext("2d")!;
            q.font = font;
            q.fillText(s, 4, 50);
            return p.toDataURL();
          };
          if (
            probe("中") === probe("\u{10FFFD}") ||
            probe("中") === probe("国")
          )
            return "";
          x.font = font;
          x.fillText(d.text, 50, 100);
        }
        return c.toDataURL("image/png");
      }, d);

    const write = async (name: string, url: string) =>
      writeFile(join(dir, name), Buffer.from(url.split(",")[1]!, "base64"));

    await write("ocr-doc.png", await draw({ kind: "doc", lines: DOC_LINES }));
    await write("ocr-ui.png", await draw({ kind: "ui", lines: UI_LINES }));
    await write("ocr-note.png", await draw({ kind: "doc", lines: NOTE_LINES }));
    const zh = await draw({ kind: "zh", text: CHINESE });
    if (zh) await write("ocr-chinese.png", zh);
    else await rm(join(dir, "ocr-chinese.png"), { force: true });
  } finally {
    await browser.close();
  }
}
