import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, sameAudio, type ToolProps } from "./Workspace";

/** Stereo to mono: both channels mixed into one. */
export default function Mono(_: ToolProps) {
  const T = useT();
  return (
    <Workspace
      tool="mono"
      suffix="mono"
      action={T("Make mono")}
      dropTitle={T("Drop audio files to make them mono")}
      job={(info) =>
        info.audio && info.audio.channels !== 1
          ? { to: sameAudio(info), audio: { channels: 1 } }
          : null
      }
      idle={T("This file is already mono.")}
      settings={() => (
        <p className="note">
          {T("Left and right are mixed into one channel. Voices sound the same; the file gets smaller.")}
        </p>
      )}
    />
  );
}
