import { useState } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Workspace, type ToolProps } from "./Workspace";

type To = "mp4" | "webm" | "mov";

/**
 * Convert: MP4, WebM or MOV, for any number of files. Streams the new format can hold are copied
 * as they are (MOV or MKV with H.264 → MP4 is a lossless remux); others are re-encoded. Task
 * pages set `preset.to`.
 */
export default function Convert({ preset }: ToolProps) {
  const T = useT();
  const [to, setTo] = useState<To>(
    preset?.to === "webm" || preset?.to === "mov" ? preset.to : "mp4",
  );
  return (
    <Workspace
      tool="convert"
      suffix=""
      action={T("Convert")}
      dropTitle={T("Drop videos to convert")}
      job={() => ({ to, copyWhenPossible: true })}
      settings={() => (
        <>
          <Seg
            label={T("Convert to")}
            options={[
              ["mp4", "MP4"],
              ["webm", "WebM"],
              ["mov", "MOV"],
            ]}
            value={to}
            onPick={setTo}
          />
          <p className="note">
            {to === "mp4"
              ? T("MP4 plays on every phone, computer and website.")
              : to === "webm"
                ? T(
                    "WebM is made for websites. Some phones and editors can't open it.",
                  )
                : T(
                    "MOV is QuickTime's format, for Apple devices and editors.",
                  )}{" "}
            {T(
              "When the video already fits the new format, it's copied as it is: fast and lossless.",
            )}
          </p>
        </>
      )}
    />
  );
}
