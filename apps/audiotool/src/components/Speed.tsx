import { useState } from "react";
import { Toggle } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime } from "@kmra/media/engine";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

const CHIPS = [0.5, 0.75, 0.9, 1.1, 1.25, 1.5, 2];
const times = (s: number) => `${Math.round(s * 100) / 100}×`;

/**
 * Speed: 0.5× to 2×, keeping the natural pitch (time-stretch) or letting it follow the speed like a
 * tape. Task pages set `preset.speed`.
 */
export default function Speed({ preset }: ToolProps) {
  const T = useT();
  const initial = Number(preset?.speed);
  const [speed, setSpeed] = useState(
    initial >= 0.5 && initial <= 2 && initial !== 1 ? initial : 1.25,
  );
  const [pitch, setPitch] = useState(true);
  return (
    <Workspace
      tool="speed"
      suffix="speed"
      action={speed > 1 ? T("Speed up") : T("Slow down")}
      dropTitle={T("Drop audio files to change their speed")}
      idle={(info) =>
        info.audio
          ? T("Pick a speed other than 1×.")
          : T("This file has no sound.")
      }
      job={(info) =>
        info.audio && speed !== 1
          ? {
              to: sameAudio(info),
              video: { speed },
              audio: pitch ? {} : { keepPitch: false },
            }
          : null
      }
      settings={({ info }) => (
        <>
          <div className="ctl">
            <label htmlFor="at-speed">
              {T("Speed")}
              <span>{times(speed)}</span>
            </label>
            <input
              id="at-speed"
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={speed}
              aria-valuetext={times(speed)}
              onChange={(e) =>
                setSpeed(Math.round(+e.target.value * 100) / 100)
              }
            />
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
          {info && speed !== 1 && (
            <p className="note">
              {T("New length: {new} (was {old})", {
                new: fmtTime(info.durationSec / speed),
                old: fmtTime(info.durationSec),
              })}
            </p>
          )}
        </>
      )}
    />
  );
}
