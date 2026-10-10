import { useEffect, useRef, useState } from "react";
import { Metronome, type MetroSettings } from "./metronome";

/**
 * A metronome for a component: start/stop, live settings, and the beat that is sounding now
 * (followed on the audio clock with requestAnimationFrame, so the lights match the clicks).
 */
export function useMetronome(settings: MetroSettings, onBpm?: (bpm: number) => void) {
  const ref = useRef<Metronome | null>(null);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState<{ beat: number; sub: number; bar: number; n: number } | null>(null);
  const onBpmRef = useRef(onBpm);
  onBpmRef.current = onBpm;

  if (!ref.current) ref.current = new Metronome(settings);
  const m = ref.current;
  m.onBpm = (bpm) => onBpmRef.current?.(bpm);

  useEffect(() => {
    m.set(settings);
  }, [settings]);

  useEffect(() => {
    if (!running) {
      setNow(null);
      return;
    }
    let raf = 0;
    let n = 0;
    const loop = () => {
      const t = m.heard();
      if (t) setNow({ beat: t.beat, sub: t.sub, bar: t.bar, n: ++n });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => m.stop(), []);

  return {
    running,
    now,
    start() {
      m.start();
      setRunning(true);
    },
    stop() {
      m.stop();
      setRunning(false);
    },
    toggle() {
      if (m.running) {
        m.stop();
        setRunning(false);
      } else {
        m.start();
        setRunning(true);
      }
    },
  };
}
