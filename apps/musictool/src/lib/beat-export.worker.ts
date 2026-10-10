/// <reference lib="webworker" />
/**
 * Renders the beat for download off the main thread: the drum sounds, the mixdown, then a WAV,
 * or an MP3 through Mediabunny with its LAME encoder (WebAssembly, loaded only for an MP3).
 */
import { DRUMS, mixdown, synth, wav, type DrumId, type Pattern } from "./drums";

export interface ExportJob {
  pattern: Pattern;
  loops: number;
  format: "wav" | "mp3";
}

const SR = 44100;

async function mp3([L, R]: [Float32Array, Float32Array]): Promise<ArrayBuffer> {
  const { Output, Mp3OutputFormat, BufferTarget, AudioSampleSource, AudioSample, canEncodeAudio } =
    await import("mediabunny");
  if (!(await canEncodeAudio("mp3"))) {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
  }
  const output = new Output({ format: new Mp3OutputFormat(), target: new BufferTarget() });
  const source = new AudioSampleSource({ codec: "mp3", bitrate: 192_000 });
  output.addAudioTrack(source);
  await output.start();
  // Planar float samples in chunks of one second
  const n = L.length;
  for (let at = 0; at < n; at += SR) {
    const len = Math.min(SR, n - at);
    const data = new Float32Array(len * 2);
    data.set(L.subarray(at, at + len), 0);
    data.set(R.subarray(at, at + len), len);
    const sample = new AudioSample({
      data,
      format: "f32-planar",
      numberOfChannels: 2,
      sampleRate: SR,
      timestamp: at / SR,
    });
    await source.add(sample);
    sample.close();
  }
  await output.finalize();
  return output.target.buffer!;
}

self.onmessage = async (e: MessageEvent<ExportJob>) => {
  try {
    const { pattern, loops, format } = e.data;
    const sounds = Object.fromEntries(DRUMS.map((d) => [d, synth(d, SR)])) as Record<DrumId, Float32Array>;
    const mix = mixdown(pattern, SR, loops, sounds);
    const out = format === "mp3" ? await mp3(mix) : wav(mix, SR);
    (self as unknown as Worker).postMessage({ ok: true, data: out }, [out]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) });
  }
};
