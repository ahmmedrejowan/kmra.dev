import { useEffect, useRef, useState } from "react";
import { Toggle } from "@kmra/ui/components/controls";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import { toast } from "@kmra/ui/lib/toast";
import {
  fmtTime,
  isAbort,
  run,
  type AudioContainer,
  type Output,
  type Progress,
} from "@kmra/media/engine";
import { EngineBadge } from "@kmra/media/components/MediaDrop";
import { WavePlayer } from "@kmra/media/components/WavePlayer";
import { FormatSeg, isFormat, LOSSLESS, RateSeg } from "./formats";
import type { ToolProps } from "./Workspace";

type Phase = "idle" | "asking" | "recording" | "done";

/** The best format this browser records sound in (Opus in WebM, or AAC in MP4 on Safari) */
function bestType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((t) => MediaRecorder.isTypeSupported(t)) ?? ""
  );
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

/**
 * Voice recorder: the microphone (echo cancellation and noise suppression on by default), with a
 * live level meter, pause and stop. The recording stays in the page; it's saved as MP3, M4A or
 * WAV by the engine, or downloaded as the browser recorded it. Task pages set `preset.to`.
 */
export default function VoiceRecorder({ preset }: ToolProps) {
  const T = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [clean, setClean] = useState(true);
  const [take, setTake] = useState<File | null>(null);
  const [problem, setProblem] = useState<string>();
  const [to, setTo] = useState<AudioContainer>(
    isFormat(preset?.to) ? preset.to : "mp3",
  );
  const [kbps, setKbps] = useState(128);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [out, setOut] = useState<{ key: string; out: Output } | null>(null);
  const rec = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    audio: AudioContext;
    chunks: Blob[];
    type: string;
    before: number;
    since: number;
  } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  // Known only in the browser (the page is built without one): checked after it loads
  const [supported, setSupported] = useState(true);
  useEffect(
    () =>
      setSupported(
        !!navigator.mediaDevices?.getUserMedia && bestType() !== null,
      ),
    [],
  );

  // Clock and level meter while recording
  useEffect(() => {
    if (phase !== "recording") return;
    let raf = 0;
    const r = rec.current;
    const an = r?.audio.createAnalyser();
    if (r && an) {
      an.fftSize = 1024;
      r.audio.createMediaStreamSource(r.stream).connect(an);
    }
    const buf = new Float32Array(1024);
    const tick = () => {
      const cur = rec.current;
      if (cur) {
        setElapsed(cur.before + (paused ? 0 : performance.now() - cur.since));
        if (an) {
          an.getFloatTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v));
          setLevel(paused ? 0 : peak);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, paused]);

  useEffect(() => () => release(), []);

  function release() {
    const r = rec.current;
    r?.stream.getTracks().forEach((t) => t.stop());
    void r?.audio.close().catch(() => {});
  }

  async function start() {
    setProblem(undefined);
    setTake(null);
    setOut(null);
    setPhase("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: clean,
          noiseSuppression: clean,
          autoGainControl: clean,
        },
      });
    } catch (e) {
      setPhase("idle");
      const name = e instanceof DOMException ? e.name : "";
      setProblem(
        name === "NotAllowedError" || name === "SecurityError"
          ? T(
              "The microphone isn't allowed. Allow it in the address bar, then press Record again.",
            )
          : name === "NotFoundError"
            ? T("No microphone was found. Connect one and try again.")
            : T("This browser couldn't start the microphone."),
      );
      return;
    }
    const type = bestType() || undefined;
    const recorder = new MediaRecorder(stream, {
      ...(type ? { mimeType: type } : {}),
      audioBitsPerSecond: 128_000,
    });
    const chunks: Blob[] = [];
    rec.current = {
      recorder,
      stream,
      audio: new AudioContext(),
      chunks,
      type: recorder.mimeType || type || "audio/webm",
      before: 0,
      since: performance.now(),
    };
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => finish();
    stream.getAudioTracks()[0]?.addEventListener("ended", () => stop());
    recorder.start(1000);
    setPaused(false);
    setElapsed(0);
    setPhase("recording");
  }

  function pause() {
    const r = rec.current;
    if (!r || r.recorder.state !== "recording") return;
    r.recorder.pause();
    r.before += performance.now() - r.since;
    setPaused(true);
  }
  function resume() {
    const r = rec.current;
    if (!r || r.recorder.state !== "paused") return;
    r.since = performance.now();
    r.recorder.resume();
    setPaused(false);
  }
  function stop() {
    const r = rec.current;
    if (!r || r.recorder.state === "inactive") return;
    if (r.recorder.state === "recording")
      r.before += performance.now() - r.since;
    setElapsed(r.before);
    r.recorder.stop();
  }
  function finish() {
    const r = rec.current;
    if (!r) return;
    release();
    rec.current = null;
    const ext = r.type.includes("mp4")
      ? "m4a"
      : r.type.includes("ogg")
        ? "ogg"
        : "webm";
    const file = new File(r.chunks, `recording-${stamp()}.${ext}`, {
      type: r.type.split(";")[0],
    });
    setTake(file);
    setLevel(0);
    setPhase("done");
  }

  const key = `${take?.name}|${to}|${kbps}`;
  const result = out && out.key === key ? out.out : null;

  async function save() {
    if (!take || busy) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setBusy(true);
    setProgress({ ratio: 0, stage: "Reading the file" });
    try {
      const o = await run(
        take,
        { to, audio: LOSSLESS.has(to) ? {} : { bitrate: kbps } },
        { signal: ac.signal, onProgress: setProgress },
      );
      setOut({ key, out: o });
      downloadBlob(o.blob, o.name);
    } catch (e) {
      if (isAbort(e)) toast(T("Cancelled"));
      else {
        console.error(e);
        toast(T("This recording couldn't be saved in that format."));
      }
    } finally {
      ctrl.current = null;
      setBusy(false);
      setProgress(null);
    }
  }

  const recording = phase === "recording";
  return (
    <div className="toolcard tri vt-ws vt-voice-recorder">
      <aside className="controls side-l">
        <div className="ctl">
          <span className="lbl">{T("Microphone")}</span>
          <Toggle
            label={T("Clean up the sound")}
            on={clean}
            onChange={setClean}
          />
          <p className="note">
            {clean
              ? T(
                  "Echo and background noise are reduced and the level is kept steady. Best for voices.",
                )
              : T("The sound is recorded as it is. Best for music.")}
          </p>
        </div>
        {phase === "done" && take && (
          <>
            <FormatSeg
              value={to}
              onPick={(v) => v !== "same" && setTo(v)}
              only={["mp3", "m4a", "wav"]}
            />
            {!LOSSLESS.has(to) && (
              <RateSeg
                value={kbps}
                onPick={setKbps}
                rates={[64, 96, 128, 192]}
              />
            )}
          </>
        )}
      </aside>

      <div className="stage vt-stage">
        <div className="vt-stage-head">
          <span className="vt-name">
            {take
              ? take.name
              : recording
                ? T("Recording")
                : T("Voice recorder")}
          </span>
        </div>
        {phase === "done" && take ? (
          <WavePlayer file={take} label={T("Recording")} />
        ) : (
          <div
            className={`at-rec${recording ? " on" : ""}${paused ? " paused" : ""}`}
          >
            <div className="at-meter" aria-hidden="true">
              <i
                style={{
                  transform: `scaleY(${Math.min(1, 0.06 + level * 1.6)})`,
                }}
              />
            </div>
            <span className="at-clock" role="timer" aria-live="off">
              {fmtTime(elapsed / 1000, 0)}
            </span>
            {!supported ? (
              <p className="note warn">
                {T(
                  "This browser can't record sound. Try a recent Chrome, Edge, Firefox or Safari.",
                )}
              </p>
            ) : recording ? (
              <div className="at-rec-ctl">
                {paused ? (
                  <button
                    type="button"
                    className="btn lg vt-resume"
                    onClick={resume}
                  >
                    <Icon name="play" />
                    {T("Resume")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn lg vt-pause"
                    onClick={pause}
                  >
                    <Icon name="pause" />
                    {T("Pause")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn acc lg vt-stop"
                  onClick={stop}
                >
                  <Icon name="record" />
                  {T("Stop")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn acc lg vt-start"
                onClick={() => void start()}
                disabled={phase === "asking"}
              >
                <Icon name="mic" />
                {phase === "asking"
                  ? T("Waiting for the microphone")
                  : T("Record")}
              </button>
            )}
            {problem && (
              <p className="note warn vt-problem" role="alert">
                {problem}
              </p>
            )}
            {phase === "idle" && !problem && (
              <p className="muted vt-hint">
                {T(
                  "Your browser asks to use the microphone the first time. The recording stays on this page until you save it.",
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="controls side-r vt-out" aria-live="polite">
        <div className="ctl">
          <span className="lbl">{T("Recording")}</span>
          <dl className="kv vt-plan">
            <div>
              <dt>{T("Length")}</dt>
              <dd>{fmtTime(elapsed / 1000)}</dd>
            </div>
            {take && (
              <div>
                <dt>{T("Size")}</dt>
                <dd>{formatBytes(take.size)}</dd>
              </div>
            )}
            {result && (
              <div>
                <dt>{T("Engine")}</dt>
                <dd>
                  <EngineBadge engine={result.engine} />
                </dd>
              </div>
            )}
          </dl>
        </div>
        {phase === "done" && take && (
          <>
            {busy ? (
              <div className="vt-progress" role="status">
                <div className="vt-pline">
                  <span>{T(progress?.stage ?? "Encoding")}</span>
                  <b>{Math.round((progress?.ratio ?? 0) * 100)}%</b>
                </div>
                <span className="mp-bar">
                  <i
                    style={{
                      width: `${Math.round((progress?.ratio ?? 0) * 100)}%`,
                    }}
                  />
                </span>
                <button
                  type="button"
                  className="btn vt-cancel"
                  onClick={() => ctrl.current?.abort()}
                >
                  <Icon name="x" />
                  {T("Cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn primary lg vt-run"
                onClick={() => void save()}
              >
                <Icon name="download" />
                {T("Save as {ext}", { ext: to.toUpperCase() })}
              </button>
            )}
            {result && (
              <div
                className="vt-result"
                data-engine={result.engine}
                data-bytes={result.blob.size}
              >
                <p className="muted vt-outinfo">
                  {[result.name, formatBytes(result.blob.size)].join(" · ")}
                </p>
                <button
                  type="button"
                  className="btn vt-download"
                  onClick={() => downloadBlob(result.blob, result.name)}
                >
                  <Icon name="download" />
                  {T("Download again")}
                </button>
              </div>
            )}
            <button
              type="button"
              className="btn sm"
              onClick={() => downloadBlob(take, take.name)}
            >
              {T("Download as recorded ({ext})", {
                ext: take.name.split(".").pop()!.toUpperCase(),
              })}
            </button>
            <button
              type="button"
              className="btn vt-again"
              onClick={() => void start()}
            >
              <Icon name="mic" />
              {T("Record again")}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
