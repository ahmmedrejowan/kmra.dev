import { useState } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Timeline } from "@kmra/media/components/Timeline";
import { sameContainer, Workspace, type ToolProps } from "./Workspace";

/**
 * Trim: keep the part between the timeline's handles. "Precise" re-encodes (cuts on the exact
 * frame); "Lossless" copies the streams and starts at the keyframe before the start (instant,
 * no quality loss, the start may move back a little).
 */
export default function Trim(_: ToolProps) {
  const T = useT();
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [mode, setMode] = useState<"precise" | "fast">("precise");
  return (
    <Workspace
      tool="trim"
      multiple={false}
      suffix="trim"
      action={T("Trim")}
      dropTitle={T("Drop a video to trim it")}
      idle={T("Drag the handles under the video to choose the part to keep.")}
      onFile={(_, info) => setRange([0, info.durationSec])}
      job={(info) => {
        const [a, b] = range;
        if (
          !(b > a) ||
          b - a < 0.1 ||
          (a <= 0.01 && b >= info.durationSec - 0.01)
        )
          return null;
        return {
          to: sameContainer(info),
          trim: { start: a, end: Math.min(b, info.durationSec) },
          copyWhenPossible: mode === "fast",
          ...(mode === "precise" ? { video: { quality: 80 } } : {}),
        };
      }}
      stage={({ file, info, time, seek }) => (
        <Timeline
          file={file}
          duration={info.durationSec}
          start={range[0]}
          end={range[1] || info.durationSec}
          time={time}
          onSeek={seek}
          onChange={(a, b) => setRange([a, b])}
        />
      )}
      settings={() => (
        <>
          <Seg
            label={T("Cut")}
            options={[
              ["precise", T("Precise")],
              ["fast", T("Lossless")],
            ]}
            value={mode}
            onPick={setMode}
          />
          <p className="note">
            {mode === "precise"
              ? T(
                  "Cuts on the exact frame. The kept part is encoded again, which takes a moment.",
                )
              : T(
                  "Instant and keeps the original quality. The start moves back to the nearest keyframe, up to a few seconds.",
                )}
          </p>
        </>
      )}
    />
  );
}
