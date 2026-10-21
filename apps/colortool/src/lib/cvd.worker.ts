/// <reference lib="webworker" />
/** Simulates colour vision on an image's pixels off the main thread. */
import { simulatePixels, type Cvd } from "./cvd";

self.onmessage = (
  e: MessageEvent<{ id: number; buffer: ArrayBuffer; type: Cvd }>,
) => {
  const { id, buffer, type } = e.data;
  try {
    simulatePixels(new Uint8ClampedArray(buffer), type);
    (self as unknown as Worker).postMessage({ id, buffer }, [buffer]);
  } catch (err) {
    // Answer anyway, so the page doesn't wait forever
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
