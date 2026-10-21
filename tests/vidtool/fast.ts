import type { Page } from "@playwright/test";

/**
 * Whether this browser can encode H.264 video and AAC sound with WebCodecs (the fast engine).
 * Linux Chromium (as on the CI machines) can't encode AAC, so jobs there fall back to ffmpeg;
 * tests that are about the fast engine itself skip rather than fail.
 */
export async function hasFastEngine(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    try {
      const video = await VideoEncoder.isConfigSupported({
        codec: "avc1.42001f",
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
      });
      const audio = await AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128_000,
      });
      return !!video.supported && !!audio.supported;
    } catch {
      return false;
    }
  });
}
