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
      // A video with no sound has nothing to remove: no run, no unchanged copy to download
      job={(info) =>
        info.audio ? { to: sameContainer(info), audio: { drop: true } } : null
      }
      idle={T("This video has no sound already.")}
      settings={() => (
        <p className="note">
          {T(
            "The picture is copied as it is, so it's quick and keeps its quality.",
          )}
        </p>
      )}
    />
  );
}
