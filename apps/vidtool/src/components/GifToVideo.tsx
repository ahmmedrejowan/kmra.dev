import { useState } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { Job } from "@kmra/media/engine";
import { BlobImage } from "./Pictures";
import { Workspace, type ToolProps } from "./Workspace";

const isAnimFile = (f: File) =>
  /^image\/(gif|webp)$/.test(f.type) || /\.(gif|webp)$/i.test(f.name);

const QUALITIES: [number, string][] = [
  [45, "Smaller"],
  [65, "Balanced"],
  [85, "Better"],
];

/**
 * GIF to video: GIFs (and animated WebP where the browser reads them) become H.264 MP4 or WebM,
 * usually many times smaller. The fast engine decodes the frames with the browser's ImageDecoder
 * and encodes with WebCodecs; ffmpeg.wasm does it otherwise (GIF only). See-through parts get a
 * background colour; the animation can repeat a few times so short loops last longer.
 */
export default function GifToVideo({ preset }: ToolProps) {
  const T = useT();
  const [to, setTo] = useState<"mp4" | "webm">(
    preset?.to === "webm" ? "webm" : "mp4",
  );
  const [repeat, setRepeat] = useState(1);
  const [bg, setBg] = useState("#ffffff");
  const [quality, setQuality] = useState(65);

  const job = (): Job => ({
    to,
    video: { quality, padColor: bg },
    ...(repeat > 1 ? { repeat } : {}),
  });

  return (
    <Workspace
      tool="gif-to-video"
      suffix="gif-to-video"
      action={T("Make video")}
      dropTitle={T("Drop GIFs to turn them into videos")}
      chooseLabel={T("Choose GIFs")}
      kind="gif"
      formats={["GIF", "WebP"]}
      accept={isAnimFile}
      inputAccept="image/gif,image/webp,.gif,.webp"
      reject={T("That isn't a GIF. Try a GIF or an animated WebP.")}
      job={job}
      preview={(blob, which) =>
        which === "original" ? (
          <div className="mp-player">
            <BlobImage blob={blob} alt={T("Original")} className="vt-gif" />
          </div>
        ) : undefined
      }
      settings={() => (
        <>
          <Seg
            label={T("Format")}
            options={[
              ["mp4", "MP4"],
              ["webm", "WebM"],
            ]}
            value={to}
            onPick={setTo}
          />
          <Seg
            label={T("Quality")}
            options={QUALITIES.map(([q, l]) => [q, T(l)] as [number, string])}
            value={quality}
            onPick={setQuality}
          />
          <Seg
            label={T("Play it")}
            options={[
              [1, T("Once")],
              [2, "2×"],
              [3, "3×"],
              [5, "5×"],
            ]}
            value={repeat}
            onPick={setRepeat}
          />
          <Seg
            label={T("Background for see-through parts")}
            options={[
              ["#ffffff", T("White")],
              ["#000000", T("Black")],
            ]}
            value={bg}
            onPick={setBg}
          />
          <p className="note vt-hint">
            {T(
              "Videos don't loop by themselves like GIFs. Repeat a short animation to make it last longer.",
            )}
          </p>
        </>
      )}
    />
  );
}
