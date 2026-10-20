import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

const CHIPS = [0.5, 0.75, 1.5, 2, 3];
const db = (v: number) => {
  const d = 20 * Math.log10(v);
  return `${d > 0 ? "+" : ""}${d.toFixed(1)} dB`;
};

/** Volume: 0.25× to 4× (shown in dB too). Task pages set `preset.volume`. */
export default function Volume({ preset }: ToolProps) {
  const T = useT();
  const initial = Number(preset?.volume);
  const [vol, setVol] = useState(initial > 0 && initial !== 1 ? initial : 1.5);
  return (
    <Workspace
      tool="volume"
      suffix="volume"
      action={vol > 1 ? T("Make louder") : T("Make quieter")}
      dropTitle={T("Drop audio files to change their volume")}
      idle={T("Pick a volume other than 100%.")}
      job={(info) =>
        info.audio && vol !== 1
          ? { to: sameAudio(info), audio: { volume: vol } }
          : null
      }
      settings={() => (
        <>
          <div className="ctl">
            <label htmlFor="at-vol">
              {T("Volume")}
              <span>
                {Math.round(vol * 100)}% · {db(vol)}
              </span>
            </label>
            <input
              id="at-vol"
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={Math.log2(vol)}
              aria-valuetext={`${Math.round(vol * 100)}%`}
              onChange={(e) => setVol(Math.round(2 ** +e.target.value * 100) / 100)}
            />
            <div className="chips vt-chips" role="group" aria-label={T("Common volumes")}>
              {CHIPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  aria-pressed={vol === v}
                  onClick={() => setVol(v)}
                >
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
          </div>
          {vol > 2 && (
            <p className="note warn">
              {T("Big boosts can distort loud parts. Normalize evens the loudness without that.")}
            </p>
          )}
        </>
      )}
    />
  );
}
