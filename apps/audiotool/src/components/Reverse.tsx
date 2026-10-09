import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

/** Reverse: plays the sound from the end to the start. */
export default function Reverse(_: ToolProps) {
  const T = useT();
  return (
    <Workspace
      tool="reverse"
      suffix="reversed"
      action={T("Reverse")}
      dropTitle={T("Drop audio files to reverse them")}
      job={(info) =>
        info.audio ? { to: sameAudio(info), audio: { reverse: true } } : null
      }
      idle={T("This file has no sound.")}
      settings={() => (
        <p className="note">{T("The whole file plays backwards, from the end to the start.")}</p>
      )}
    />
  );
}
