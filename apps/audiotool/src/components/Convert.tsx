import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { AudioContainer, MediaInfo } from "@kmra/media/engine";
import { FormatSeg, isFormat, LOSSLESS, RateSeg, RATES } from "./formats";
import { Workspace, type ToolProps } from "./Workspace";

/**
 * Convert: any audio (or a video's sound) to MP3, M4A, WAV, OGG, Opus or FLAC at a chosen bitrate.
 * Copies the sound without re-encoding when it already fits the format. Task pages set
 * `preset.to` and `preset.kbps`.
 */
export default function Convert({ preset }: ToolProps) {
  const T = useT();
  const [to, setTo] = useState<AudioContainer>(
    isFormat(preset?.to) ? preset.to : "mp3",
  );
  const [kbps, setKbps] = useState(
    RATES.includes(Number(preset?.kbps)) ? Number(preset?.kbps) : 192,
  );
  const lossless = LOSSLESS.has(to);
  return (
    <Workspace
      tool="convert"
      suffix="convert"
      action={T("Convert")}
      dropTitle={T("Drop audio files to convert them")}
      formats={["MP3", "WAV", "M4A", "FLAC", "OGG", "AAC", "MP4"]}
      job={(info: MediaInfo) =>
        info.audio
          ? {
              to,
              audio: lossless ? {} : { bitrate: kbps },
              copyWhenPossible: true,
            }
          : null
      }
      idle={T("This file has no sound.")}
      settings={() => (
        <>
          <FormatSeg value={to} onPick={(v) => v !== "same" && setTo(v)} />
          {lossless ? (
            <p className="note">
              {to === "wav"
                ? T("WAV keeps every detail and makes big files.")
                : T("FLAC keeps every detail at about half the size of WAV.")}
            </p>
          ) : (
            <RateSeg value={kbps} onPick={setKbps} />
          )}
        </>
      )}
    />
  );
}
