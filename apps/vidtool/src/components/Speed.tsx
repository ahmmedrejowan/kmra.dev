import { useEffect, useRef, useState } from "react";
import { Seg, Toggle } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime, type Job, type MediaInfo } from "@kmra/media/engine";
import { VideoPreview } from "@kmra/media/components/VideoPreview";
import { sameContainer, Workspace, type ToolProps } from "./Workspace";

const CHIPS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4];
const MIN = 0.25;
const MAX = 4;

/** 1.5 → "1.5×" */
export const times = (s: number) => `${Math.round(s * 100) / 100}×`;

/** Slider position (log2 of the speed) → speed rounded to a step people can read */
const fromPos = (p: number) => {
  const s = 2 ** p;
  return Math.min(
    MAX,
    Math.max(MIN, Math.round(s * (s < 1 ? 20 : 10)) / (s < 1 ? 20 : 10)),
  );
};

/**
 * Speed: 0.25× to 4× (chips and a slider on a doubling scale). The sound is kept at its natural
 * pitch (time-stretched), kept like a tape (pitch follows the speed) or removed. The preview plays
 * at the chosen speed. Task pages set `preset.speed`.
 */
export default function Speed({ preset }: ToolProps) {
  const T = useT();
  const initial = Number(preset?.speed);
  const [speed, setSpeed] = useState(
    initial >= MIN && initial <= MAX && initial !== 1 ? initial : 2,
  );
  const [sound, setSound] = useState<"keep" | "drop">("keep");
  const [pitch, setPitch] = useState(true);
  const [aspect, setAspect] = useState<number | undefined>();
  const ref = useRef<HTMLVideoElement | null>(null);

  // The preview plays at the chosen speed, with the chosen sound
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.defaultPlaybackRate = speed;
    v.playbackRate = speed;
    v.preservesPitch = pitch;
    v.muted = sound === "drop";
  });

  const job = (info: MediaInfo): Job | null => {
    if (speed === 1 || !info.video) return null;
    return {
      to: sameContainer(info),
      video: { speed, quality: 75 },
      audio:
        sound === "drop" ? { drop: true } : pitch ? {} : { keepPitch: false },
    };
  };

  return (
    <Workspace
      tool="speed"
      suffix="speed"
      action={speed > 1 ? T("Speed up") : T("Slow down")}
      dropTitle={T("Drop a video to change its speed")}
      idle={(info) =>
        info.video
          ? T("Pick a speed other than 1×.")
          : T("This file has no video to change.")
      }
      job={job}
      onFile={(_, info) =>
        setAspect(info.video ? info.video.width / info.video.height : undefined)
      }
      preview={(blob, which) =>
        which === "original" ? (
          <VideoPreview
            file={blob}
            aspect={aspect}
            videoRef={ref}
            label={T("Original")}
          />
        ) : undefined
      }
      settings={({ info }) => (
        <>
          <div className="ctl vt-speed">
            <label htmlFor="vt-speed">
              {T("Speed")}
              <span>{times(speed)}</span>
            </label>
            <input
              id="vt-speed"
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={Math.log2(speed)}
              aria-valuetext={times(speed)}
              onChange={(e) => setSpeed(fromPos(+e.target.value))}
              onDoubleClick={() => setSpeed(1)}
            />
            <div className="vt-speed-ends" aria-hidden="true">
              <span>{T("Slower")}</span>
              <span>1×</span>
              <span>{T("Faster")}</span>
            </div>
            <div
              className="chips vt-chips"
              role="group"
              aria-label={T("Common speeds")}
            >
              {CHIPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  aria-pressed={speed === s}
                  onClick={() => setSpeed(s)}
                >
                  {times(s)}
                </button>
              ))}
            </div>
          </div>
          {info?.audio && (
            <>
              <Seg
                label={T("Sound")}
                options={[
                  ["keep", T("Keep")],
                  ["drop", T("Remove")],
                ]}
                value={sound}
                onPick={setSound}
              />
              {sound === "keep" && (
                <div className="ctl">
                  <Toggle
                    label={T("Keep the natural pitch")}
                    on={pitch}
                    onChange={setPitch}
                  />
                  <p className="note">
                    {pitch
                      ? T("Voices sound normal, just faster or slower.")
                      : T(
                          "The pitch follows the speed, like a tape: higher when faster, lower when slower.",
                        )}
                  </p>
                </div>
              )}
            </>
          )}
          {info && speed !== 1 && (
            <p className="note vt-newlen">
              {T("New length: {new} (was {old})", {
                new: fmtTime(info.durationSec / speed),
                old: fmtTime(info.durationSec),
              })}
            </p>
          )}
        </>
      )}
      note={(info) =>
        speed < 1 && info.video && info.video.fps > 0 && info.video.fps < 50 ? (
          <p className="note">
            {T(
              "Frames are repeated to slow it down. Videos shot at 60 fps or more give smoother slow motion.",
            )}
          </p>
        ) : null
      }
    />
  );
}
