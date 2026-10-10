import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Write a steady tone as a 16-bit PCM mono WAV for Chromium's fake microphone
 * (--use-file-for-fake-audio-capture, which loops the file). Returns its path.
 */
export function toneWav(freq: number, seconds = 4, rate = 48000): string {
  const dir = join(tmpdir(), "kmra-musictool");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `tone-${freq}.wav`);
  // A whole number of periods, so the loop point is seamless
  const periods = Math.round(freq * seconds);
  const n = Math.round((periods / freq) * rate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    // A string-like tone: fundamental plus a few harmonics
    const t = i / rate;
    const v =
      0.5 * Math.sin(2 * Math.PI * freq * t) +
      0.18 * Math.sin(2 * Math.PI * 2 * freq * t) +
      0.08 * Math.sin(2 * Math.PI * 3 * freq * t);
    data.writeInt16LE(Math.round(v * 0.9 * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
  return path;
}

export const fakeMic = (wav: string) => ({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${wav}`,
    ],
  },
});
