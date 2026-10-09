import { useEffect, useRef, useState, type Ref } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime } from "../plan";

/**
 * A plain native player for a File or Blob: sized to the video's own shape (no letterbox band),
 * with the current time under it. Formats the browser can't play (AVI, some MKV) show a note
 * instead: the engine can still convert them.
 *
 *   <VideoPreview file={file} aspect={w / h} onTime={setT} videoRef={ref} />
 *
 * `seek` moves the playhead when it changes (e.g. from a timeline). `audio` shows an audio player.
 */
export function VideoPreview({
  file,
  poster,
  seek,
  onTime,
  onDuration,
  videoRef,
  audio,
  label,
  aspect,
  className = "",
}: {
  file: Blob | null;
  poster?: string;
  seek?: { t: number; n: number };
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  videoRef?: Ref<HTMLVideoElement>;
  audio?: boolean;
  /** Accessible name of the player */
  label?: string;
  /** Width ÷ height, when known (from probe): the player takes its shape before the video loads */
  aspect?: number;
  className?: string;
}) {
  const T = useT();
  const own = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    setBad(false);
    setT(0);
    if (!file) return setUrl("");
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    const v = own.current;
    if (v && seek && Number.isFinite(seek.t)) {
      v.currentTime = seek.t;
      setT(seek.t);
    }
  }, [seek?.t, seek?.n]);

  const setRef = (el: HTMLVideoElement | null) => {
    own.current = el;
    if (typeof videoRef === "function") videoRef(el);
    else if (videoRef)
      (videoRef as { current: HTMLVideoElement | null }).current = el;
  };

  if (!file) return null;
  if (audio)
    return (
      <div className={`mp-player audio ${className}`}>
        <audio
          src={url}
          controls
          preload="metadata"
          aria-label={label ?? T("Preview")}
        />
      </div>
    );
  return (
    <div className={`mp-player ${className}`}>
      {bad ? (
        <div className="mp-cant" role="note">
          <strong>{T("This video can't play in the browser")}</strong>
          <span>
            {T(
              "It can still be converted. Convert it to MP4 to watch it here.",
            )}
          </span>
        </div>
      ) : (
        <video
          ref={setRef}
          className="mp-video"
          style={
            aspect && Number.isFinite(aspect) && aspect > 0
              ? ({ "--ar": aspect } as React.CSSProperties)
              : undefined
          }
          src={url || undefined}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          aria-label={label ?? T("Preview")}
          onTimeUpdate={(e) => {
            setT(e.currentTarget.currentTime);
            onTime?.(e.currentTarget.currentTime);
          }}
          onSeeked={(e) => {
            setT(e.currentTarget.currentTime);
            onTime?.(e.currentTarget.currentTime);
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) {
              setDur(d);
              onDuration?.(d);
            }
          }}
          onError={() => setBad(true)}
        />
      )}
      {!bad && dur > 0 && (
        <div className="mp-time" aria-hidden="true">
          {fmtTime(t)} / {fmtTime(dur)}
        </div>
      )}
    </div>
  );
}
