import { useState } from "react";
import { Mp3Credit } from "@kmra/media/components/Mp3Credit";
import { Seg, Toggle } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import type { AudioContainer, MediaInfo } from "@kmra/media/engine";
import { Workspace, type ToolProps } from "./Workspace";

const MB = 1_000_000;
const SIZES = [1, 5, 10, 20];
/** Smaller targets leave too few bits even for speech */
const MIN_MB = 0.02;

/** Compressed formats keep theirs (MP3, M4A, OGG, Opus); WAV, FLAC and others become MP3 */
const lossyOut = (info: MediaInfo): AudioContainer => {
  const c = info.container;
  const codec = info.audio?.codec ?? "";
  if (c === "mp3") return "mp3";
  if (c === "ogg") return codec === "opus" ? "opus" : "ogg";
  if ((c === "mp4" || c === "mov" || c === "aac") && codec === "aac")
    return "m4a";
  return "mp3";
};

/** The source's sound bitrate, bits/s (from the stream, else size over length; 0 = unknown) */
const sourceBitrate = (info: MediaInfo, file: File): number =>
  info.audio?.bitrate ||
  (info.durationSec > 0 ? (file.size * 8) / info.durationSec : 0);

/**
 * Compress: a lower bitrate (quality), or a target size the bitrate is worked out from. "Speech"
 * mixes to mono, which halves the size with no loss for voices. Task pages set `preset.targetMB`
 * or `preset.voice`.
 */
export default function Compress({ preset }: ToolProps) {
  const T = useT();
  const target = Number(preset?.targetMB);
  const voice = preset?.voice === true;
  const [mode, setMode] = useState<"quality" | "size">(
    target > 0 ? "size" : "quality",
  );
  const [kbps, setKbps] = useState(voice ? 48 : 96);
  const [mb, setMb] = useState(target > 0 ? target : 5);
  const [mbText, setMbText] = useState(String(target > 0 ? target : 5));
  const [mono, setMono] = useState(voice);

  /**
   * Never bigger: a file already under the target size, or already at the chosen bitrate or
   * less, isn't compressed (the run stays off and the output column says why).
   */
  const shrinks = (info: MediaInfo, file: File): "ok" | "under" | "rate" => {
    if (mode === "size") return file.size <= mb * MB ? "under" : "ok";
    const src = sourceBitrate(info, file);
    return src > 0 && kbps * 1000 >= src * 0.9 ? "rate" : "ok";
  };

  return (
    <Workspace
      tool="compress"
      suffix="compress"
      action={T("Compress")}
      dropTitle={T("Drop audio files to compress them")}
      formats={["MP3", "WAV", "M4A", "FLAC", "OGG"]}
      job={(info, file) => {
        if (!info.audio || shrinks(info, file) !== "ok") return null;
        return {
          to: lossyOut(info),
          ...(mode === "size" ? { targetBytes: Math.round(mb * MB) } : {}),
          audio: {
            ...(mode === "quality" ? { bitrate: kbps } : {}),
            ...(mono ? { channels: 1 as const } : {}),
          },
        };
      }}
      idle={(info, file) => {
        const why = info.audio ? shrinks(info, file) : "silent";
        return why === "under"
          ? T(
              "This file is already under {size}, so there's nothing to compress.",
              {
                size: `${mb} MB`,
              },
            )
          : why === "rate"
            ? T(
                "This file is already at {kbps} kbps or less, so it wouldn't get smaller. Pick a lower quality.",
                { kbps },
              )
            : T("This file has no sound.");
      }}
      note={(info) =>
        info.container !== "mp3" &&
        lossyOut(info) === "mp3" &&
        info.audio?.codec !== "mp3" ? (
          <>
            <p className="note">{T("Saved as MP3, which plays everywhere.")}</p>
            <Mp3Credit />
          </>
        ) : lossyOut(info) === "mp3" ? (
          <Mp3Credit />
        ) : null
      }
      settings={() => (
        <>
          <Seg
            label={T("Compress by")}
            options={[
              ["quality", T("Quality")],
              ["size", T("Target size")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "quality" ? (
            <Seg
              label={T("Quality (kbps)")}
              options={[
                [32, "32"],
                [48, "48"],
                [64, "64"],
                [96, "96"],
                [128, "128"],
              ]}
              value={kbps}
              onPick={setKbps}
            />
          ) : (
            <div className="ctl vt-target">
              <label htmlFor="vt-mb">
                {T("Target size")}
                <span>{formatBytes(mb * MB)}</span>
              </label>
              <div className="vt-mb">
                <input
                  id="vt-mb"
                  className="num"
                  inputMode="decimal"
                  value={mbText}
                  onChange={(e) => {
                    setMbText(e.target.value);
                    const n = parseFloat(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n >= 0)
                      setMb(Math.min(2000, Math.max(MIN_MB, n)));
                  }}
                  onBlur={() => setMbText(String(mb))}
                />
                <span>MB</span>
              </div>
              {parseFloat(mbText.replace(",", ".")) < MIN_MB && (
                <p className="note">
                  {T("The smallest target is {size}.", {
                    size: `${MIN_MB} MB`,
                  })}
                </p>
              )}
              <div
                className="chips vt-chips"
                role="group"
                aria-label={T("Common sizes")}
              >
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    aria-pressed={mb === s}
                    onClick={() => {
                      setMb(s);
                      setMbText(String(s));
                    }}
                  >
                    {s} MB
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ctl">
            <Toggle label={T("Speech (mono)")} on={mono} onChange={setMono} />
            <p className="note">
              {T(
                "For voices, one channel sounds the same and halves the size.",
              )}
            </p>
          </div>
        </>
      )}
    />
  );
}
