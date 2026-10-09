/**
 * AudioTool inputs: short generated sounds (sine tones), so the repo carries no third-party audio.
 * Made with the ffmpeg command line; tests that need them skip without it.
 *
 *   aud-tone.mp3      6 s, 44.1 kHz stereo, 440 Hz left / 660 Hz right, 192 kbps MP3
 *   aud-tone.wav      4 s, 48 kHz stereo PCM (16-bit)
 *   aud-voice.m4a     5 s, 44.1 kHz mono AAC, a quieter 220 Hz tone (like a voice memo)
 *   aud-tone.flac     3 s, 44.1 kHz stereo FLAC
 *   aud-tone.ogg      3 s, 48 kHz stereo Opus in Ogg (like a WhatsApp voice note)
 *   aud-gaps.wav      7 s mono: 1 s tone, 2 s silence, 1 s tone, 2 s silence, 1 s tone
 *   aud-quiet.wav     3 s mono, a very quiet tone (−30 dBFS) for volume and normalize
 *   aud-part1/2/3.mp3 2 s, 3 s, 2 s, stereo MP3 (join)
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const AUD = {
  mp3: "aud-tone.mp3",
  wav: "aud-tone.wav",
  m4a: "aud-voice.m4a",
  flac: "aud-tone.flac",
  ogg: "aud-tone.ogg",
  gaps: "aud-gaps.wav",
  quiet: "aud-quiet.wav",
  part1: "aud-part1.mp3",
  part2: "aud-part2.mp3",
  part3: "aud-part3.mp3",
} as const;

const stereo = (sec: number, rate = 44100) => [
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=440:sample_rate=${rate}:duration=${sec}`,
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=660:sample_rate=${rate}:duration=${sec}`,
  "-filter_complex",
  "[0:a][1:a]amerge=inputs=2,volume=0.5[a]",
  "-map",
  "[a]",
];

export async function makeAudiotoolFixtures(dir: string) {
  try {
    await run("ffmpeg", ["-hide_banner", "-version"]);
  } catch {
    return;
  }
  const make = async (name: string, args: string[]) => {
    const out = join(dir, name);
    if (existsSync(out)) return;
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args, out]);
  };
  await make(AUD.mp3, [...stereo(6), "-c:a", "libmp3lame", "-b:a", "192k"]);
  await make(AUD.wav, [...stereo(4, 48000), "-c:a", "pcm_s16le"]);
  await make(AUD.m4a, [
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100:duration=5",
    "-af", "volume=0.3", "-ac", "1", "-c:a", "aac", "-b:a", "64k",
  ]);
  await make(AUD.flac, [...stereo(3), "-c:a", "flac"]);
  await make(AUD.ogg, [...stereo(3, 48000), "-c:a", "libopus", "-b:a", "96k"]);
  await make(AUD.gaps, [
    "-f", "lavfi", "-i",
    "sine=frequency=500:sample_rate=44100:duration=7",
    "-af",
    "volume='if(between(t,1,3)+between(t,4,6),0,0.5)':eval=frame",
    "-ac", "1", "-c:a", "pcm_s16le",
  ]);
  await make(AUD.quiet, [
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=3",
    "-af", "volume=-30dB", "-ac", "1", "-c:a", "pcm_s16le",
  ]);
  for (const [name, sec] of [
    [AUD.part1, 2],
    [AUD.part2, 3],
    [AUD.part3, 2],
  ] as const)
    await make(name, [...stereo(sec), "-c:a", "libmp3lame", "-b:a", "128k"]);
}
