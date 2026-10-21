/// <reference lib="webworker" />
/** The metronome's wake-up timer. Worker timers keep running at full rate in background tabs. */
let id = 0;
self.onmessage = (e: MessageEvent<number>) => {
  clearInterval(id);
  id = self.setInterval(
    () => (self as unknown as Worker).postMessage(0),
    e.data,
  );
};
