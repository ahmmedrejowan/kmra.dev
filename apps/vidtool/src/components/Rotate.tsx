import { useEffect, useRef, useState } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import { fmtTime, type Job, type MediaInfo } from "@kmra/media/engine";
import { sameContainer, Workspace, type ToolProps } from "./Workspace";

type Turn = 0 | 90 | 180 | 270;
type Flip = "" | "h" | "v";

/** Whether a turn can be made by display rotation only (no re-encode) for this file */
const quickOk = (info: MediaInfo | null, turn: Turn, flip: Flip) => {
  if (!info || !turn || flip) return false;
  const to = sameContainer(info);
  return to === "mp4" || to === "mov";
};

/**
 * Rotate: 90° left or right, 180°, flip horizontally or vertically, previewed live (the player
 * turns with CSS). A plain turn of an MP4/MOV is made "quickly" by default: only the display
 * rotation changes, nothing is re-encoded. Flips and other formats are re-encoded. Task pages set
 * `preset.turn` (90 = right, 270 = left).
 */
export default function Rotate({ preset }: ToolProps) {
  const T = useT();
  const p = Number(preset?.turn);
  const [turn, setTurn] = useState<Turn>(
    p === 90 || p === 180 || p === 270 ? p : 90,
  );
  const [flip, setFlip] = useState<Flip>("");
  const [how, setHow] = useState<"quick" | "encode">("quick");

  const job = (info: MediaInfo): Job | null => {
    if ((!turn && !flip) || !info.video) return null;
    const quick = how === "quick" && quickOk(info, turn, flip);
    return {
      to: sameContainer(info),
      video: {
        ...(turn ? { rotate: turn } : {}),
        ...(flip ? { flip } : {}),
        ...(quick ? { rotateMetadata: true } : { quality: 80 }),
      },
    };
  };

  return (
    <Workspace
      tool="rotate"
      suffix="rotate"
      action={flip && !turn ? T("Flip") : T("Rotate")}
      dropTitle={T("Drop a video to rotate it")}
      idle={(info) =>
        info.video
          ? T("Pick a turn or a flip.")
          : T("This file has no video to change.")
      }
      job={job}
      preview={(blob, which) =>
        which === "original" ? (
          <TurnPreview blob={blob} turn={turn} flip={flip} />
        ) : undefined
      }
      settings={({ info }) => (
        <>
          <div className="ctl">
            <span className="lbl">{T("Turn")}</span>
            <div className="vt-turns" role="group" aria-label={T("Turn")}>
              {(
                [
                  [270, T("90° left")],
                  [90, T("90° right")],
                  [180, "180°"],
                  [0, T("None")],
                ] as [Turn, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="btn sm"
                  aria-pressed={turn === v}
                  onClick={() => setTurn(v)}
                >
                  {v ? (
                    <Icon
                      name="rotate"
                      className={`ico${v === 90 ? " vt-mirror" : ""}`}
                    />
                  ) : null}
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Seg
            label={T("Flip")}
            options={[
              ["", T("None")],
              ["h", T("Horizontal")],
              ["v", T("Vertical")],
            ]}
            value={flip}
            onPick={setFlip}
          />
          {quickOk(info, turn, flip) ? (
            <>
              <Seg
                label={T("How")}
                options={[
                  ["quick", T("Quick")],
                  ["encode", T("Re-encode")],
                ]}
                value={how}
                onPick={setHow}
              />
              <p className="note">
                {how === "quick"
                  ? T(
                      "Instant and lossless: only the video's rotation setting changes. Phones, browsers and most players follow it; a few older editors don't.",
                    )
                  : T(
                      "The picture itself is turned and encoded again, so every player shows it the right way up. Takes a moment.",
                    )}
              </p>
            </>
          ) : (
            (turn || flip) && (
              <p className="note">
                {T(
                  "The picture is turned and encoded again, so every player shows it the right way up.",
                )}
              </p>
            )
          )}
        </>
      )}
    />
  );
}

/**
 * The original, turned and flipped live with CSS. Native controls would turn too, so it has its
 * own play button and time.
 */
function TurnPreview({
  blob,
  turn,
  flip,
}: {
  blob: Blob;
  turn: Turn;
  flip: Flip;
}) {
  const T = useT();
  const ref = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState("");
  const [dims, setDims] = useState<[number, number] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    setBad(false);
    setDims(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const side = turn === 90 || turn === 270;
  const ar = dims
    ? side
      ? dims[1] / dims[0]
      : dims[0] / dims[1]
    : side
      ? 9 / 16
      : 16 / 9;
  const tf = `${flip === "h" ? "scaleX(-1) " : flip === "v" ? "scaleY(-1) " : ""}rotate(${turn}deg)`;
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  if (bad)
    return (
      <div className="mp-player">
        <div className="mp-cant" role="note">
          <strong>{T("This video can't play in the browser")}</strong>
          <span>
            {T("It can still be turned. The result plays in more places.")}
          </span>
        </div>
      </div>
    );
  return (
    <div className="mp-player vt-turnview">
      <div
        className={`vt-turn${side ? " side" : ""}`}
        style={{ "--ar": ar, "--tf": tf } as React.CSSProperties}
      >
        <video
          ref={ref}
          src={url || undefined}
          playsInline
          preload="metadata"
          aria-label={T("Preview")}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth) setDims([v.videoWidth, v.videoHeight]);
            if (Number.isFinite(v.duration)) setDur(v.duration);
          }}
          onError={() => setBad(true)}
        />
      </div>
      <div className="vt-turnbar">
        <button
          type="button"
          className="btn sm"
          onClick={toggle}
          aria-label={playing ? T("Pause") : T("Play")}
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.01}
          value={t}
          aria-label={T("Position")}
          onChange={(e) => {
            const v = ref.current;
            if (v) v.currentTime = +e.target.value;
            setT(+e.target.value);
          }}
        />
        <span className="mp-time">
          {fmtTime(t)} / {fmtTime(dur)}
        </span>
      </div>
    </div>
  );
}
