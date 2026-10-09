import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

const label = (s: number) => (s > 0 ? `+${s}` : `${s}`);

/** Pitch: −12 to +12 semitones; the length stays the same. */
export default function Pitch(_: ToolProps) {
  const T = useT();
  const [semi, setSemi] = useState(2);
  return (
    <Workspace
      tool="pitch"
      suffix={`pitch${label(semi)}`}
      action={semi > 0 ? T("Raise the pitch") : T("Lower the pitch")}
      dropTitle={T("Drop audio files to change their pitch")}
      idle={T("Pick a shift other than 0.")}
      job={(info) =>
        info.audio && semi !== 0
          ? { to: sameAudio(info), audio: { pitch: semi } }
          : null
      }
      settings={() => (
        <>
          <div className="ctl">
            <label htmlFor="at-pitch">
              {T("Pitch")}
              <span>{T("{n} semitones", { n: label(semi) })}</span>
            </label>
            <input
              id="at-pitch"
              type="range"
              min={-12}
              max={12}
              step={1}
              value={semi}
              aria-valuetext={T("{n} semitones", { n: label(semi) })}
              onChange={(e) => setSemi(+e.target.value)}
            />
            <div className="chips vt-chips" role="group" aria-label={T("Common shifts")}>
              {[-12, -5, -2, -1, 1, 2, 5, 12].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  aria-pressed={semi === s}
                  onClick={() => setSemi(s)}
                >
                  {label(s)}
                </button>
              ))}
            </div>
          </div>
          <p className="note">
            {T("12 semitones is an octave. The speed and length stay the same.")}
          </p>
        </>
      )}
    />
  );
}
