/**
 * Microphone input for the tuner. The browser's voice processing (echo cancellation, noise
 * suppression, automatic gain) is switched off: it bends pitch and level. Samples go
 * microphone → AudioWorklet → pitch worker; readings come back to the page. Nothing is recorded
 * or sent anywhere, and stop() releases the microphone (the browser's mic indicator goes off).
 */
import { audio, testHook } from "./audio";
import type { Pitch } from "./pitch";
import tapUrl from "./tap.worklet.ts?worker&url";

export type MicProblem = "denied" | "nomic" | "busy" | "insecure" | "other";

export interface Reading {
  pitch: Pitch | null;
  /** Peak level of the latest block, 0 … 1 */
  level: number;
}

export interface Listener {
  stop(): void;
}

const worklets = new WeakSet<BaseAudioContext>();

export function micProblem(e: unknown): MicProblem {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "nomic";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "other";
}

export async function listen(
  onReading: (r: Reading) => void,
): Promise<Listener> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw Object.assign(new Error("insecure"), { name: "Insecure" });
  const c = audio();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  testHook("mic", stream);
  const worker = new Worker(new URL("./pitch.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<Reading>) => onReading(e.data);

  const src = c.createMediaStreamSource(stream);
  // Keeps the graph pulling without making any sound
  const silent = c.createGain();
  silent.gain.value = 0;
  silent.connect(c.destination);

  let node: AudioNode;
  let poll = 0;
  try {
    if (!worklets.has(c)) {
      await c.audioWorklet.addModule(tapUrl);
      worklets.add(c);
    }
    const tap = new AudioWorkletNode(c, "kmra-tuner-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    const ch = new MessageChannel();
    worker.postMessage({ sampleRate: c.sampleRate, port: ch.port2 }, [
      ch.port2,
    ]);
    tap.port.postMessage({ port: ch.port1 }, [ch.port1]);
    node = tap;
  } catch {
    // No AudioWorklet: read the newest samples from an analyser instead
    const an = c.createAnalyser();
    an.fftSize = 4096;
    worker.postMessage({ sampleRate: c.sampleRate });
    const buf = new Float32Array(an.fftSize);
    poll = window.setInterval(() => {
      an.getFloatTimeDomainData(buf);
      worker.postMessage({ block: buf.slice() });
    }, 40);
    node = an;
  }
  src.connect(node);
  node.connect(silent);

  return {
    stop() {
      clearInterval(poll);
      try {
        src.disconnect();
        node.disconnect();
        silent.disconnect();
      } catch {
        // already disconnected
      }
      worker.terminate();
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
