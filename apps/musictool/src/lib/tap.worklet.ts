/**
 * AudioWorklet for the tuner: copies the microphone's samples in blocks of 1024 and hands them
 * straight to the pitch worker through a MessagePort, so the page's main thread never touches
 * the audio. Nothing is stored; each block is passed on and forgotten.
 */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: unknown): void;

const BLOCK = 1024;

class Tap extends AudioWorkletProcessor {
  private out: MessagePort | null = null;
  private buf = new Float32Array(BLOCK);
  private n = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<{ port: MessagePort }>) => {
      this.out = e.data.port;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch || !this.out) return true;
    let i = 0;
    while (i < ch.length) {
      const take = Math.min(ch.length - i, BLOCK - this.n);
      this.buf.set(ch.subarray(i, i + take), this.n);
      this.n += take;
      i += take;
      if (this.n === BLOCK) {
        this.out.postMessage(this.buf, [this.buf.buffer]);
        this.buf = new Float32Array(BLOCK);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor("kmra-tuner-tap", Tap);
