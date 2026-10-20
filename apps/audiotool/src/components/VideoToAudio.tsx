import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { isMediaFile, VIDEO_ACCEPT, type AudioContainer } from "@kmra/media/engine";
import { FormatSeg, isFormat, LOSSLESS, RateSeg } from "./formats";
import { Workspace, type ToolProps } from "./Workspace";

/**
 * Video to audio: the sound of a video as MP3, M4A (copied without re-encoding when the video's
 * sound is AAC), WAV, OGG, Opus or FLAC. Task pages set `preset.to`.
 */
export default function VideoToAudio({ preset }: ToolProps) {
  const T = useT();
  const [to, setTo] = useState<AudioContainer>(
    isFormat(preset?.to) ? preset.to : "mp3",
  );
  const [kbps, setKbps] = useState(192);
  return (
    <Workspace
      tool="video-to-audio"
      suffix="video-to-audio"
      action={T("Save the sound")}
      dropTitle={T("Drop videos to save their sound")}
      chooseLabel={T("Choose videos")}
      formats={["MP4", "MOV", "WebM", "MKV", "AVI"]}
      inputAccept={VIDEO_ACCEPT}
      accept={isMediaFile}
      job={(info) =>
        info.audio
          ? {
              to,
              video: { drop: true },
              // M4A: AAC sound is copied as it is (no bitrate asked, so nothing to re-encode)
              audio: LOSSLESS.has(to) || to === "m4a" ? {} : { bitrate: kbps },
              copyWhenPossible: true,
            }
          : null
      }
      idle={T("This video has no sound.")}
      settings={() => (
        <>
          <FormatSeg value={to} onPick={(v) => v !== "same" && setTo(v)} />
          {!LOSSLESS.has(to) && to !== "m4a" && (
            <RateSeg value={kbps} onPick={setKbps} />
          )}
          {to === "m4a" && (
            <p className="note">
              {T("If the video's sound is AAC, it's copied as it is: instant, and no quality lost.")}
            </p>
          )}
        </>
      )}
    />
  );
}
