import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime, type AudioContainer } from "@kmra/media/engine";
import { Timeline } from "@kmra/media/components/Timeline";
import { FormatSeg, isFormat, resolveFormat, type FormatPick } from "./formats";
import { Workspace, type ToolProps } from "./Workspace";

const RINGTONE_MAX = 40;

/**
 * Cut: keep the part between two handles on the waveform (or typed times). `preset.ringtone`
 * makes an iPhone ringtone (M4A renamed .m4r, at most 40 s, 30 s to start); `preset.seconds`
 * starts with a range that long; `preset.to` picks the format.
 */
export default function Trim({ preset }: ToolProps) {
  const T = useT();
  const ringtone = preset?.ringtone === true;
  const seconds = ringtone ? 30 : Number(preset?.seconds) || 0;
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [dur, setDur] = useState(0);
  const [to, setTo] = useState<FormatPick>(
    ringtone
      ? "m4a"
      : isFormat(preset?.to)
        ? (preset!.to as AudioContainer)
        : "same",
  );
  const [a, b] = range;
  const whole = dur > 0 && a <= 0.01 && b >= dur - 0.01;

  return (
    <Workspace
      tool="trim"
      multiple={false}
      suffix="trim"
      action={ringtone ? T("Make the ringtone") : T("Cut")}
      dropTitle={
        ringtone
          ? T("Drop a song to make a ringtone")
          : T("Drop an audio file to cut it")
      }
      rename={ringtone ? (n) => n.replace(/\.m4a$/i, ".m4r") : undefined}
      onFile={(_, info) => {
        const d = info.durationSec;
        setDur(d);
        setRange([0, seconds > 0 ? Math.min(d, seconds) : d]);
      }}
      unknownSize={T("Depends on the cut")}
      idle={T("Move a handle to choose the part to keep.")}
      job={(info) =>
        info.audio && !whole && b - a >= 0.1
          ? { to: resolveFormat(to, info), trim: { start: a, end: b } }
          : null
      }
      stage={({ file, info, time, seek }) => (
        <Timeline
          wave
          file={file}
          duration={info.durationSec}
          start={a}
          end={b}
          maxLength={ringtone ? RINGTONE_MAX : undefined}
          onChange={(s, e) => setRange([s, e])}
          time={time}
          onSeek={seek}
        />
      )}
      settings={({ info }) => (
        <>
          {ringtone ? (
            <p className="note">
              {T("Saved as an M4R ringtone, up to {n} seconds.", {
                n: RINGTONE_MAX,
              })}
            </p>
          ) : (
            <FormatSeg
              value={to}
              onPick={setTo}
              same
              only={["mp3", "m4a", "wav"]}
            />
          )}
          {info && (
            <p className="note">
              {T("Keeping {len} of {total}", {
                len: fmtTime(Math.max(0, b - a)),
                total: fmtTime(info.durationSec),
              })}
            </p>
          )}
        </>
      )}
    />
  );
}
