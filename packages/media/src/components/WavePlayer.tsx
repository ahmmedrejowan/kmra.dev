import { useEffect, useRef, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime } from "../plan";
import { drawPeaks, usePeaks, waveColors } from "./Wave";

/**
 * An audio player drawn as a waveform: click or drag on it to seek, Space/arrows on it to play and
 * step, the played part in the accent colour. `seek` moves the playhead from outside (n changes
 * each time); `onTime` reports it.
 */
export function WavePlayer({
  file,
  label,
  seek,
  onTime,
  onDuration,
  className = "",
}: {
  file: Blob | null;
  label?: string;
  seek?: { t: number; n: number };
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  className?: string;
}) {
  const T = useT();
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [width, setWidth] = useState(0);
  const [bad, setBad] = useState(false);
  const { peaks, failed } = usePeaks(file);

  useEffect(() => {
    setBad(false);
    setT(0);
    setPlaying(false);
    if (!file) return setUrl("");
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw on new peaks, size or playhead
  useEffect(() => {
    const c = canvas.current;
    if (!c || !peaks || !width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const H = c.clientHeight || 160;
    if (c.width !== Math.round(width * dpr)) c.width = Math.round(width * dpr);
    if (c.height !== Math.round(H * dpr)) c.height = Math.round(H * dpr);
    drawPeaks(c, peaks, { ...waveColors(c), played: dur ? t / dur : 0 });
  }, [peaks, width, t, dur]);

  useEffect(() => {
    if (!seek || !audio.current) return;
    audio.current.currentTime = seek.t;
    setT(seek.t);
  }, [seek?.n]);

  const at = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (dur || 0);
  };
  const go = (s: number) => {
    const a = audio.current;
    if (!a || !dur) return;
    a.currentTime = Math.max(0, Math.min(dur, s));
    setT(a.currentTime);
    onTime?.(a.currentTime);
  };
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setBad(true));
    else a.pause();
  };

  return (
    <div className={`wp ${className}`}>
      <audio
        ref={audio}
        src={url || undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) {
            setDur(d);
            onDuration?.(d);
          }
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDur(d);
        }}
        onTimeUpdate={(e) => {
          setT(e.currentTarget.currentTime);
          onTime?.(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setBad(true)}
      />
      <div
        ref={box}
        className="wp-wave"
        role="slider"
        tabIndex={0}
        aria-label={label ?? T("Position")}
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(t)}
        aria-valuetext={`${fmtTime(t)} / ${fmtTime(dur)}`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          go(at(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) go(at(e.clientX));
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            go(t + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 2));
          }
        }}
      >
        <canvas ref={canvas} aria-hidden="true" />
        {!peaks && !failed && (
          <span className="wp-wait muted">{T("Drawing the waveform")}</span>
        )}
        {dur > 0 && (
          <i className="wp-head" style={{ left: `${(t / dur) * 100}%` }} />
        )}
      </div>
      <div className="wp-bar">
        <button
          type="button"
          className="btn acc wp-play"
          onClick={toggle}
          disabled={!url || bad}
          aria-label={playing ? T("Pause") : T("Play")}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <span className="wp-time">
          <b>{fmtTime(t)}</b> / {fmtTime(dur)}
        </span>
        {bad && (
          <span className="muted wp-bad">
            {T(
              "This browser can't play this format, but the tools still work.",
            )}
          </span>
        )}
      </div>
    </div>
  );
}
