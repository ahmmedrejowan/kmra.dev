import { useState } from "react";
import { Seg, Slider } from "@kmra/ui/components/controls";
import { formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { Job } from "@kmra/media/engine";
import { shortSide, Workspace, type ToolProps } from "./Workspace";

/** Megabytes as people (and WhatsApp, Discord, mail services) count them */
const MB = 1_000_000;
const SIZES = [8, 10, 16, 25, 50];
const QUALITIES: [number, string][] = [
  [35, "Smaller"],
  [55, "Balanced"],
  [75, "Better"],
];

/**
 * Compress: a quality (three presets plus a slider) or a target size in MB (the engine works out
 * the bitrate, lowers the resolution of long clips and checks the result). Task pages set
 * `preset.targetMB`.
 */
export default function Compress({ preset }: ToolProps) {
  const T = useT();
  const initial = Number(preset?.targetMB) || 0;
  const [mode, setMode] = useState<"quality" | "size">(
    initial ? "size" : "quality",
  );
  const [quality, setQuality] = useState(55);
  const [mb, setMb] = useState(initial || 16);
  const [mbText, setMbText] = useState(String(initial || 16));
  const [maxH, setMaxH] = useState(0);
  const [to, setTo] = useState<"mp4" | "webm">("mp4");

  const job = (info: Parameters<typeof shortSide>[0]): Job => {
    const v = info.video;
    const scale =
      maxH && v && Math.min(v.width, v.height) > maxH
        ? shortSide(info, maxH)
        : {};
    return {
      to,
      video: { ...scale, ...(mode === "quality" ? { quality } : {}) },
      ...(mode === "size" ? { targetBytes: mb * MB } : {}),
    };
  };

  return (
    <Workspace
      tool="compress"
      suffix="compressed"
      action={T("Compress")}
      dropTitle={T("Drop a video to compress it")}
      job={job}
      settings={() => (
        <>
          <Seg
            label={T("Make it smaller by")}
            options={[
              ["quality", T("Quality")],
              ["size", T("Target size")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "quality" ? (
            <>
              <Seg
                label={T("Quality")}
                options={QUALITIES.map(
                  ([q, l]) => [q, T(l)] as [number, string],
                )}
                value={QUALITIES.some(([q]) => q === quality) ? quality : -1}
                onPick={setQuality}
              />
              <Slider
                label={T("Fine-tune")}
                value={quality}
                min={5}
                max={95}
                onChange={setQuality}
              />
            </>
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
                    if (Number.isFinite(n) && n >= 0.5 && n <= 4000) setMb(n);
                  }}
                  onBlur={() => setMbText(String(mb))}
                />
                <span>MB</span>
              </div>
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
          <Seg
            label={T("Largest resolution")}
            options={[
              [0, T("Keep")],
              [1080, "1080p"],
              [720, "720p"],
              [480, "480p"],
            ]}
            value={maxH}
            onPick={setMaxH}
          />
          <Seg
            label={T("Format")}
            options={[
              ["mp4", "MP4"],
              ["webm", "WebM"],
            ]}
            value={to}
            onPick={setTo}
          />
        </>
      )}
      note={(info, file) =>
        mode === "size" && file.size <= mb * MB ? (
          <p className="note">
            {T("This video is already under {size}.", { size: `${mb} MB` })}
          </p>
        ) : mode === "size" &&
          info.durationSec > 0 &&
          (mb * MB * 8) / info.durationSec < 300_000 ? (
          <p className="note warn">
            {T(
              "That's very small for this length: the picture will be blurry. Trim the video first for a sharper result.",
            )}
          </p>
        ) : null
      }
    />
  );
}
