import { useState } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

/**
 * Remove silence: cuts gaps quieter than a threshold and longer than a minimum, leaving a short
 * pause so speech still flows. The result's length depends on the recording.
 */
export default function RemoveSilence(_: ToolProps) {
  const T = useT();
  const [db, setDb] = useState(-45);
  const [min, setMin] = useState(0.5);
  return (
    <Workspace
      tool="remove-silence"
      suffix="remove-silence"
      action={T("Remove silence")}
      dropTitle={T("Drop recordings to remove the silent gaps")}
      job={(info) =>
        info.audio
          ? {
              to: sameAudio(info),
              audio: { removeSilence: { thresholdDb: db, minSec: min } },
            }
          : null
      }
      idle={T("This file has no sound.")}
      settings={() => (
        <>
          <Seg
            label={T("Counts as silence")}
            options={[
              [-55, T("Very quiet")],
              [-45, T("Quiet")],
              [-35, T("Background noise")],
            ]}
            value={db}
            onPick={setDb}
          />
          <Seg
            label={T("Gaps longer than")}
            options={[
              [0.3, "0.3 s"],
              [0.5, "0.5 s"],
              [1, "1 s"],
              [2, "2 s"],
            ]}
            value={min}
            onPick={setMin}
          />
          <p className="note">
            {T(
              "A short pause stays where each gap was, so speech doesn't run together. Pick Background noise for recordings with a hum.",
            )}
          </p>
        </>
      )}
    />
  );
}
