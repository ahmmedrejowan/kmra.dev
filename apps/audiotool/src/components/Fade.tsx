import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime } from "@kmra/media/engine";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

const s1 = (v: number) => `${v.toFixed(1)} s`;

/** Fade in and out: a smooth start and end, each 0–15 s. */
export default function Fade(_: ToolProps) {
  const T = useT();
  const [fin, setIn] = useState(3);
  const [fout, setOut] = useState(3);
  return (
    <Workspace
      tool="fade"
      suffix="faded"
      action={T("Add the fades")}
      dropTitle={T("Drop audio files to fade them in and out")}
      idle={T("Set a fade longer than 0 s.")}
      job={(info) =>
        info.audio && (fin > 0 || fout > 0)
          ? {
              to: sameAudio(info),
              audio: {
                ...(fin > 0 ? { fadeInSec: Math.min(fin, info.durationSec / 2) } : {}),
                ...(fout > 0 ? { fadeOutSec: Math.min(fout, info.durationSec / 2) } : {}),
              },
            }
          : null
      }
      settings={({ info }) => (
        <>
          {(
            [
              ["fade-in", T("Fade in"), fin, setIn],
              ["fade-out", T("Fade out"), fout, setOut],
            ] as const
          ).map(([id, label, v, set]) => (
            <div className="ctl" key={id}>
              <label htmlFor={id}>
                {label}
                <span>{v ? s1(v) : T("Off")}</span>
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={v}
                aria-valuetext={v ? s1(v) : T("Off")}
                onChange={(e) => set(+e.target.value)}
              />
            </div>
          ))}
          {info && (
            <p className="note">
              {T("Length {len}: fades longer than half of it are shortened.", {
                len: fmtTime(info.durationSec),
              })}
            </p>
          )}
        </>
      )}
    />
  );
}
