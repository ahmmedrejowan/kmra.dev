import { useState } from "react";
import { Mp3Credit } from "@kmra/media/components/Mp3Credit";
import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { codecLabel, type MediaInfo } from "@kmra/media/engine";
import { Workspace, type ToolProps } from "./Workspace";

type To = "mp3" | "m4a" | "wav";

/** AAC sound can go into an M4A as it is */
const isAac = (info: MediaInfo) =>
  !!info.audio && /aac/i.test(info.audio.codec);

/**
 * Video to MP3: the sound as MP3 (LAME in wasm when the browser has no MP3 encoder), M4A (AAC;
 * "Original" copies an AAC track without re-encoding) or WAV.
 */
export default function VideoToMp3({ preset }: ToolProps) {
  const T = useT();
  const [to, setTo] = useState<To>(
    preset?.to === "m4a" || preset?.to === "wav" ? preset.to : "mp3",
  );
  const [kbps, setKbps] = useState(192);
  const accept = (f: File) =>
    f.type.startsWith("video/") ||
    f.type.startsWith("audio/") ||
    /\.(mp4|m4v|mov|webm|mkv|avi|flv|wmv|3gp|mts|m2ts|ts|ogv)$/i.test(f.name);
  return (
    <Workspace
      tool="video-to-mp3"
      suffix="video-to-mp3"
      action={T("Save the sound")}
      dropTitle={T("Drop videos to get their sound")}
      idle={T("This video has no sound to save.")}
      accept={accept}
      job={(info) => {
        if (!info.audio) return null;
        if (to === "wav") return { to };
        // M4A "Original": an AAC track is copied as it is; other sound is encoded at 192k, so
        // the choice works the same for every file of a batch
        if (to === "m4a" && !kbps)
          return isAac(info) ? { to } : { to, audio: { bitrate: 192 } };
        return { to, audio: { bitrate: kbps || 192 } };
      }}
      settings={({ info }) => (
        <>
          <Seg
            label={T("Format")}
            options={[
              ["mp3", "MP3"],
              ["m4a", "M4A"],
              ["wav", "WAV"],
            ]}
            value={to}
            onPick={(v) => {
              setTo(v);
              if (v === "mp3" && !kbps) setKbps(192);
            }}
          />
          {to !== "wav" && (
            <Seg
              label={T("Quality")}
              options={[
                ...(to === "m4a"
                  ? ([[0, T("Original")]] as [number, string][])
                  : []),
                [128, "128k"],
                [192, "192k"],
                [256, "256k"],
                [320, "320k"],
              ]}
              value={kbps}
              onPick={setKbps}
            />
          )}
          <p className="note">
            {to === "mp3"
              ? T("MP3 plays everywhere. 192k sounds right for most videos.")
              : to === "m4a"
                ? T(
                    "M4A (AAC) is smaller than MP3 for the same sound, and what most videos already use.",
                  )
                : T(
                    "WAV is uncompressed: the best for editing, but about ten times bigger.",
                  )}
          </p>
          {to === "mp3" && <Mp3Credit />}
          {info?.audio && (
            <p className="muted vt-src">
              {T("The video's sound")}: {codecLabel(info.audio.codec)}
              {info.audio.bitrate
                ? `, ${Math.round(info.audio.bitrate / 1000)} kbps`
                : ""}
            </p>
          )}
        </>
      )}
      // No sound: the output column already says so (idle), so no second note here
      note={(info) =>
        info.audio && to === "m4a" && !kbps && !isAac(info) ? (
          <p className="note">
            {T(
              "This video's sound isn't AAC, so it can't be copied as it is. It's encoded at 192k instead.",
            )}
          </p>
        ) : null
      }
    />
  );
}
