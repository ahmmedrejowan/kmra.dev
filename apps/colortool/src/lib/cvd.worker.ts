/// <reference lib="webworker" />
/** Simulates colour vision on an image's pixels off the main thread. */
import { simulatePixels, type Cvd } from "./cvd";

self.onmessage = (
  e: MessageEvent<{ id: number; buffer: ArrayBuffer; type: Cvd }>,
) => {
  const { id, buffer, type } = e.data;
  simulatePixels(new Uint8ClampedArray(buffer), type);
  (self as unknown as Worker).postMessage({ id, buffer }, [buffer]);
};
