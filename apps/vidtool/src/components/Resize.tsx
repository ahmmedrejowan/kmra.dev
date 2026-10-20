import { useState } from "react";
import { Colors, Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { Fit, Job, MediaInfo } from "@kmra/media/engine";
import { shortSide, Workspace, type ToolProps } from "./Workspace";

type Shape = "original" | "16:9" | "9:16" | "1:1" | "4:5";
const SHAPES: Shape[] = ["original", "16:9", "9:16", "1:1", "4:5"];

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Output width × height for a shape and a short side (0 = the source's short side) */
export function resizeTo(
  info: MediaInfo,
  shape: Shape,
  short: number,
): { width?: number; height?: number } {
  const v = info.video;
  if (!v) return {};
  const S = short || Math.min(v.width, v.height);
  if (shape === "original") return short ? shortSide(info, short) : {};
  const [a, b] = shape.split(":").map(Number) as [number, number];
  return a >= b
    ? { width: even((S * a) / b), height: even(S) }
    : { width: even(S), height: even((S * b) / a) };
}

/**
 * Resize: a resolution (short side 2160/1080/720/480) and/or a shape (16:9, 9:16, 1:1, 4:5) with
 * crop, pad (a colour) or a blurred pad. Task pages set `preset.aspect`.
 */
export default function Resize({ preset }: ToolProps) {
  const T = useT();
  const initial = SHAPES.includes(preset?.aspect as Shape)
    ? (preset!.aspect as Shape)
    : "original";
  const [shape, setShape] = useState<Shape>(initial);
  const [short, setShort] = useState(initial === "original" ? 720 : 1080);
  const [fit, setFit] = useState<Fit>("cover");
  const [pad, setPad] = useState("#000000");

  const job = (info: MediaInfo): Job | null => {
    const size = resizeTo(info, shape, short);
    if (!size.width && !size.height) return null;
    return {
      to: "mp4",
      video: {
        ...size,
        quality: 75,
        ...(shape !== "original"
          ? { fit, ...(fit === "contain" ? { padColor: pad } : {}) }
          : {}),
      },
    };
  };

  return (
    <Workspace
      tool="resize"
      suffix="resize"
      action={T("Resize")}
      dropTitle={T("Drop a video to resize it")}
      idle={T("Pick a resolution or a shape.")}
      job={job}
      settings={() => (
        <>
          <Seg
            label={T("Shape")}
            options={SHAPES.map(
              (s) => [s, s === "original" ? T("Same") : s] as [Shape, string],
            )}
            value={shape}
            onPick={setShape}
          />
          <Seg
            label={T("Resolution")}
            options={[
              [0, T("Same")],
              [2160, "4K"],
              [1080, "1080p"],
              [720, "720p"],
              [480, "480p"],
            ]}
            value={short}
            onPick={setShort}
          />
          {shape !== "original" && (
            <Seg
              label={T("Fit")}
              options={[
                ["cover", T("Crop")],
                ["contain", T("Pad")],
                ["pad-blur", T("Blur")],
              ]}
              value={fit === "stretch" ? "cover" : fit}
              onPick={setFit}
            />
          )}
          {shape !== "original" && fit === "contain" && (
            <Colors label={T("Padding colour")} value={pad} onPick={setPad} />
          )}
        </>
      )}
      note={(info) => {
        const v = info.video;
        const size = resizeTo(info, shape, short);
        return v &&
          size.width &&
          size.height &&
          size.width * size.height > v.width * v.height * 1.05 ? (
          <p className="note">
            {T(
              "This is bigger than the original: it won't add detail, only size.",
            )}
          </p>
        ) : null;
      }}
    />
  );
}
