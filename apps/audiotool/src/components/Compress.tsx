import { useState } from "react";
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
  if ((c === "mp4" || c === "mov" || c === "aac") && codec === "aac") return "m4a";
  return "mp3";
};

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

  return (
    <Workspace
      tool="compress"
      suffix="compressed"
      action={T("Compress")}
      dropTitle={T("Drop audio files to compress them")}
      formats={["MP3", "WAV", "M4A", "FLAC", "OGG"]}
      job={(info) =>
        info.audio
          ? {
              to: lossyOut(info),
              ...(mode === "size"
                ? { targetBytes: Math.round(mb * MB) }
                : {}),
              audio: {
                ...(mode === "quality" ? { bitrate: kbps } : {}),
                ...(mono ? { channels: 1 as const } : {}),
              },
            }
          : null
      }
      idle={T("This file has no sound.")}
      note={(info, file) =>
        mode === "size" && file.size <= mb * MB ? (
          <p className="note">
            {T("This file is already under {size}.", { size: `${mb} MB` })}
          </p>
        ) : info.container !== "mp3" &&
          lossyOut(info) === "mp3" &&
          info.audio?.codec !== "mp3" ? (
          <p className="note">{T("Saved as MP3, which plays everywhere.")}</p>
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
                  {T("The smallest target is {size}.", { size: `${MIN_MB} MB` })}
                </p>
              )}
              <div className="chips vt-chips" role="group" aria-label={T("Common sizes")}>
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
              {T("For voices, one channel sounds the same and halves the size.")}
            </p>
          </div>
        </>
      )}
    />
  );
}
