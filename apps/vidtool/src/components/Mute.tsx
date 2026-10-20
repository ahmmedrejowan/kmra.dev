import { useT } from "@kmra/ui/lib/i18n-react";
import { sameContainer, Workspace, type ToolProps } from "./Workspace";

/** Remove audio: the picture is copied as it is (no re-encode), the sound track is left out. */
export default function Mute(_: ToolProps) {
  const T = useT();
  return (
    <Workspace
      tool="mute"
      suffix="mute"
      action={T("Remove sound")}
      dropTitle={T("Drop videos to remove the sound")}
      job={(info) => ({ to: sameContainer(info), audio: { drop: true } })}
      settings={() => (
        <p className="note">
          {T(
            "The picture is copied as it is, so it's quick and keeps its quality.",
          )}
        </p>
      )}
      note={(info) =>
        info.audio ? null : (
          <p className="note">{T("This video has no sound already.")}</p>
        )
      }
    />
  );
}
