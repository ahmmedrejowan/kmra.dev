import { useMemo, useState } from "react";
import { Seg, Toggle } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import {
  estimateGif,
  fmtTime,
  outputSize,
  type Job,
  type MediaInfo,
} from "@kmra/media/engine";
import { Timeline } from "@kmra/media/components/Timeline";
import { BlobImage, debounced } from "./Pictures";
import { Workspace, type ToolProps } from "./Workspace";

const WIDTHS = [320, 480, 640];
const RATES = [10, 12, 15, 20, 25];
/** Longest part a GIF may take, seconds (they grow fast; past this an MP4 is the better choice) */
const MAX_LEN = 60;
type Dither = "bayer" | "diffusion" | "none";

/**
 * Video to GIF: pick the part on the timeline (the first 5 s to start), the width, frame rate,
 * colours and dithering, and whether it loops. ffmpeg.wasm makes a palette for the clip, then
 * applies it (palettegen + paletteuse). The size estimate is measured on a short sample.
 */
export default function VideoToGif(_: ToolProps) {
  const T = useT();
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [width, setWidth] = useState(480);
  const [custom, setCustom] = useState(false);
  const [widthText, setWidthText] = useState("480");
  const [fps, setFps] = useState(12);
  const [colors, setColors] = useState(256);
  const [dither, setDither] = useState<Dither>("bayer");
  const [loop, setLoop] = useState(true);
  const wait = useMemo(() => debounced(600), []);

  const job = (info: MediaInfo): Job | null => {
    const [a, b] = range;
    if (!(b > a) || !info.video) return null;
    return {
      to: "gif",
      trim: { start: a, end: Math.min(b, info.durationSec) },
      gif: {
        width: Math.min(width, info.video.width),
        fps: Math.min(fps, Math.round(info.video.fps) || fps),
        loop,
        dither: dither === "none" ? false : dither,
        colors,
      },
    };
  };

  const estimate = async (info: MediaInfo, file: File, j: Job) => {
    if (!(await wait())) return null;
    try {
      return await estimateGif(file, j, { info });
    } catch {
      return null;
    }
  };

  return (
    <Workspace
      tool="video-to-gif"
      multiple={false}
      suffix=""
      action={T("Make GIF")}
      dropTitle={T("Drop a video to make a GIF")}
      idle={T("This file has no picture to make a GIF from.")}
      onFile={(_, info) => setRange([0, Math.min(5, info.durationSec)])}
      job={job}
      estimate={estimate}
      preview={(blob, which) =>
        which === "result" ? (
          <div className="mp-player">
            <BlobImage blob={blob} alt={T("Result")} className="vt-gif" />
          </div>
        ) : undefined
      }
      stage={({ file, info, time, seek }) => (
        <Timeline
          file={file}
          duration={info.durationSec}
          start={range[0]}
          end={range[1] || Math.min(5, info.durationSec)}
          time={time}
          onSeek={seek}
          maxLength={MAX_LEN}
          onChange={(a, b) => setRange([a, b])}
        />
      )}
      settings={({ info }) => (
        <>
          <div className="ctl">
            <Seg
              label={T("Width")}
              options={[
                ...WIDTHS.map((w) => [w, `${w} px`] as [number, string]),
                [0, T("Custom")],
              ]}
              value={custom ? 0 : width}
              onPick={(w) => {
                if (w) {
                  setCustom(false);
                  setWidth(w);
                  setWidthText(String(w));
                } else setCustom(true);
              }}
            />
            {custom && (
              <div className="vt-mb">
                <input
                  id="vt-gif-w"
                  className="num"
                  inputMode="numeric"
                  aria-label={T("Width in pixels")}
                  value={widthText}
                  onChange={(e) => {
                    setWidthText(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (n >= 64 && n <= 1920) setWidth(n);
                  }}
                  onBlur={() => setWidthText(String(width))}
                />
                <span>px</span>
              </div>
            )}
            {info?.video && width > info.video.width && (
              <p className="muted vt-hint">
                {T("The video is {w} px wide, so the GIF stays at that size.", {
                  w: info.video.width,
                })}
              </p>
            )}
          </div>
          <Seg
            label={T("Frame rate")}
            options={RATES.map((r) => [r, `${r} fps`] as [number, string])}
            value={fps}
            onPick={setFps}
          />
          <Seg
            label={T("Colours")}
            options={[
              [64, "64"],
              [128, "128"],
              [256, "256"],
            ]}
            value={colors}
            onPick={setColors}
          />
          <Seg
            label={T("Dithering")}
            options={[
              ["bayer", T("Pattern")],
              ["diffusion", T("Smooth")],
              ["none", T("Off")],
            ]}
            value={dither}
            onPick={setDither}
          />
          <p className="note vt-hint">
            {dither === "bayer"
              ? T("A fine pattern blends the colours. Small files.")
              : dither === "diffusion"
                ? T("The smoothest gradients, but larger files.")
                : T(
                    "Flat colours. Smallest for cartoons and screen recordings.",
                  )}
          </p>
          <div className="ctl">
            <span className="lbl">{T("Playback")}</span>
            <Toggle label={T("Loop forever")} on={loop} onChange={setLoop} />
          </div>
        </>
      )}
      note={(info) => {
        const j = job(info);
        if (!j?.trim || !j.gif) return null;
        const len = j.trim.end - j.trim.start;
        const frames = Math.max(1, Math.round(len * (j.gif.fps ?? 12)));
        const { width: w, height: h } = outputSize(info, j);
        const long = len > 15 || w * h * frames > 640 * 360 * 200;
        return (
          <>
            <p className="muted vt-hint vt-gif-facts">
              {T("{n} frames, {len}", { n: frames, len: fmtTime(len) })}
            </p>
            {long && (
              <p className="note warn">
                {T(
                  "Long or large GIFs get heavy fast. A shorter part, a smaller width or fewer frames keep it light; for long clips an MP4 is far smaller.",
                )}
              </p>
            )}
          </>
        );
      }}
    />
  );
}
