import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

/** Normalize: EBU R128 loudness to −16 LUFS (true peak −1.5 dB), the usual podcast target. */
export default function Normalize(_: ToolProps) {
  const T = useT();
  return (
    <Workspace
      tool="normalize"
      suffix="normalize"
      action={T("Normalize")}
      dropTitle={T("Drop audio files to even out their loudness")}
      job={(info) =>
        info.audio ? { to: sameAudio(info), audio: { normalize: true } } : null
      }
      idle={T("This file has no sound.")}
      settings={() => (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Loudness")}</dt>
              <dd>−16 LUFS</dd>
            </div>
            <div>
              <dt>{T("Peak limit")}</dt>
              <dd>−1.5 dBTP</dd>
            </div>
          </dl>
          <p className="note">
            {T(
              "Every file comes out equally loud: the level podcast apps and streaming services aim for.",
            )}
          </p>
        </>
      )}
    />
  );
}
