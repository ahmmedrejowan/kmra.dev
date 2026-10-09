import { useEffect, useRef, useState } from "react";
import { Seg, Toggle } from "@kmra/ui/components/controls";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import { toast } from "@kmra/ui/lib/toast";
import {
  fmtTime,
  isAbort,
  probe,
  run,
  type MediaInfo,
  type Output,
  type Progress,
} from "@kmra/media/engine";
import { VideoPreview } from "@kmra/media/components/VideoPreview";
import type { ToolProps } from "./Workspace";

type Phase =
  "idle" | "asking" | "countdown" | "recording" | "finishing" | "done";

/** Recording formats, best first: MP4 (H.264) where MediaRecorder makes it, else WebM */
const TYPES = [
  "video/mp4;codecs=avc1.64001F,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function bestType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

const canCapture = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getDisplayMedia &&
  typeof MediaRecorder !== "undefined";

/** "screen-recording-2026-10-09-1305" */
function recordingName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `screen-recording-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

interface Take {
  file: File;
  info?: MediaInfo;
  /** The MP4 made from a WebM recording */
  mp4?: Output;
}

/**
 * Screen recorder: getDisplayMedia (a screen, window or tab, with its sound where the browser
 * shares it) plus the microphone if wanted, mixed with Web Audio, recorded with MediaRecorder
 * (MP4 where the browser makes it, else WebM). Countdown, pause and resume, stops when sharing
 * ends. The recording is tidied (a lossless copy, so it seeks properly), shown, and can be
 * downloaded or converted to MP4. Nothing leaves the device.
 */
export default function ScreenRecorder(_: ToolProps) {
  const T = useT();
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sysAudio, setSysAudio] = useState(true);
  const [mic, setMic] = useState(false);
  const [fps, setFps] = useState(30);
  const [countdown, setCountdown] = useState(true);
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [problem, setProblem] = useState<string>();
  const [converting, setConverting] = useState<Progress | null>(null);
  const live = useRef<HTMLVideoElement>(null);
  const rec = useRef<{
    recorder: MediaRecorder;
    streams: MediaStream[];
    audio?: AudioContext;
    chunks: Blob[];
    type: string;
    /** Recorded milliseconds before the current stretch, and when it started */
    before: number;
    since: number;
  } | null>(null);
  const preview = useRef<MediaStream | null>(null);
  const convertCtl = useRef<AbortController | null>(null);

  // Known only in the browser (the page is prerendered without MediaRecorder)
  const [mp4, setMp4] = useState(false);
  useEffect(() => {
    setSupported(canCapture() && !!bestType());
    setMp4((bestType() ?? "").startsWith("video/mp4"));
  }, []);

  // The running clock (only while recording, not while paused)
  useEffect(() => {
    if (phase !== "recording" || paused) return;
    const id = setInterval(() => {
      const r = rec.current;
      if (r) setElapsed(r.before + performance.now() - r.since);
    }, 200);
    return () => clearInterval(id);
  }, [phase, paused]);

  // Stop everything if the page goes away mid-recording
  useEffect(() => () => release(), []);

  useEffect(() => {
    if (live.current) live.current.srcObject = preview.current;
  }, [phase]);

  function release() {
    const r = rec.current;
    r?.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    void r?.audio?.close().catch(() => {});
    preview.current = null;
  }

  async function start() {
    setProblem(undefined);
    setTake(null);
    setPhase("asking");
    const streams: MediaStream[] = [];
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: fps, max: fps } },
        audio: sysAudio,
      });
      streams.push(display);
    } catch (e) {
      setPhase("idle");
      const name = e instanceof DOMException ? e.name : "";
      setProblem(
        name === "NotAllowedError" || name === "AbortError"
          ? T(
              "Sharing was cancelled or blocked. Press Start recording and choose a screen, window or tab to share.",
            )
          : T("This browser couldn't start screen sharing."),
      );
      return;
    }
    let voice: MediaStream | null = null;
    if (mic)
      try {
        voice = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streams.push(voice);
      } catch {
        toast(
          T("The microphone isn't allowed, so the recording has no voice."),
        );
      }

    // One sound track: the shared sound and the voice mixed, or whichever there is
    const sounds = [
      ...display.getAudioTracks(),
      ...(voice?.getAudioTracks() ?? []),
    ];
    let audio: AudioContext | undefined;
    let soundTrack: MediaStreamTrack | undefined = sounds[0];
    if (sounds.length > 1) {
      audio = new AudioContext();
      const out = audio.createMediaStreamDestination();
      for (const t of sounds)
        audio.createMediaStreamSource(new MediaStream([t])).connect(out);
      soundTrack = out.stream.getAudioTracks()[0];
    }
    const video = display.getVideoTracks()[0]!;
    const mixed = new MediaStream([video, ...(soundTrack ? [soundTrack] : [])]);
    preview.current = new MediaStream([video]);
    const type = bestType()!;
    const s = video.getSettings();
    const px = (s.width ?? 1920) * (s.height ?? 1080) * (s.frameRate ?? fps);
    const recorder = new MediaRecorder(mixed, {
      mimeType: type,
      videoBitsPerSecond: Math.round(
        Math.max(2_500_000, Math.min(12_000_000, px * 0.1)),
      ),
      audioBitsPerSecond: 128_000,
    });
    const chunks: Blob[] = [];
    rec.current = {
      recorder,
      streams,
      audio,
      chunks,
      type,
      before: 0,
      since: 0,
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
        setBytes((n) => n + e.data.size);
      }
    };
    recorder.onstop = () => void finish();
    // Stopping the share from the browser's own bar ends the recording
    video.addEventListener("ended", () => stop());

    setElapsed(0);
    setBytes(0);
    setPaused(false);
    if (countdown) {
      setPhase("countdown");
      for (let i = 3; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
        if (rec.current?.recorder !== recorder) return;
        if (video.readyState === "ended") return;
      }
    }
    recorder.start(1000);
    rec.current.since = performance.now();
    setPhase("recording");
  }

  function pause() {
    const r = rec.current;
    if (!r || r.recorder.state !== "recording") return;
    r.recorder.pause();
    r.before += performance.now() - r.since;
    setElapsed(r.before);
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
    if (!r) return;
    if (r.recorder.state === "inactive") {
      // Stopped during the countdown: nothing was recorded
      release();
      rec.current = null;
      setPhase("idle");
      return;
    }
    if (r.recorder.state === "recording")
      r.before += performance.now() - r.since;
    setElapsed(r.before);
    r.recorder.stop();
  }

  async function finish() {
    const r = rec.current;
    if (!r) return;
    release();
    rec.current = null;
    setPhase("finishing");
    const mp4 = r.type.startsWith("video/mp4");
    const ext: "mp4" | "webm" = mp4 ? "mp4" : "webm";
    const raw = new File(
      [new Blob(r.chunks, { type: r.type.split(";")[0] })],
      `${recordingName()}.${ext}`,
      {
        type: r.type.split(";")[0],
      },
    );
    // Recorded files have no length or seek index; a lossless copy adds them
    let file = raw;
    try {
      const out = await run(
        raw,
        { to: ext, copyWhenPossible: true },
        { engine: "webcodecs" },
      );
      if (out.blob.size > 0)
        file = new File([out.blob], raw.name, { type: raw.type });
    } catch (e) {
      console.info("Keeping the recording as it was:", e);
    }
    const info = await probe(file).catch(() => undefined);
    setTake({ file, info });
    setPhase("done");
  }

  async function toMp4() {
    if (!take || converting) return;
    const ac = new AbortController();
    convertCtl.current = ac;
    setConverting({ ratio: 0, stage: "Reading the video" });
    try {
      const out = await run(
        take.file,
        { to: "mp4", video: { quality: 80 } },
        { signal: ac.signal, onProgress: setConverting },
      );
      setTake((t) => (t ? { ...t, mp4: out } : t));
    } catch (e) {
      if (isAbort(e)) toast(T("Cancelled"));
      else {
        console.error(e);
        toast(T("This video couldn't be processed."));
      }
    } finally {
      convertCtl.current = null;
      setConverting(null);
    }
  }

  const recording = phase === "recording" || phase === "countdown";
  const ext = take?.file.name.split(".").pop()!.toUpperCase();

  return (
    <div className="toolcard tri vt-ws vt-screen-recorder" data-phase={phase}>
      <aside className="controls side-l">
        <div className="ctl">
          <span className="lbl">{T("Sound")}</span>
          <div className="vt-toggles">
            <Toggle
              label={T("Sound from the screen or tab")}
              on={sysAudio}
              onChange={setSysAudio}
            />
            <Toggle label={T("Microphone")} on={mic} onChange={setMic} />
          </div>
        </div>
        <Seg
          label={T("Frame rate")}
          options={[
            [30, "30 fps"],
            [60, "60 fps"],
          ]}
          value={fps}
          onPick={setFps}
        />
        <div className="ctl">
          <span className="lbl">{T("Start")}</span>
          <Toggle
            label={T("Count down from 3")}
            on={countdown}
            onChange={setCountdown}
          />
        </div>
        <p className="note vt-hint">
          {T(
            "Your browser asks what to share: the whole screen, one window or a tab. Sound from the screen works best with a tab in Chrome or Edge.",
          )}
        </p>
      </aside>

      <div className="stage vt-stage">
        {phase === "done" && take ? (
          <>
            <div className="vt-stage-head">
              <span className="vt-name" title={take.file.name}>
                {take.mp4 ? take.mp4.name : take.file.name}
              </span>
            </div>
            <VideoPreview
              file={take.mp4?.blob ?? take.file}
              aspect={
                take.info?.video
                  ? take.info.video.width / take.info.video.height
                  : undefined
              }
              label={T("Recording")}
            />
          </>
        ) : recording || phase === "finishing" ? (
          <div className="vt-live">
            <video ref={live} className="mp-video" autoPlay muted playsInline />
            {phase === "countdown" && (
              <div className="vt-countdown" aria-live="assertive">
                {count}
              </div>
            )}
            {phase === "finishing" && (
              <div className="vt-countdown small" role="status">
                {T("Finishing the recording")}
              </div>
            )}
          </div>
        ) : (
          <div className="vt-rec-idle">
            <span className="vt-rec-icon" aria-hidden="true">
              <Icon name="record" />
            </span>
            <strong>{T("Record your screen, a window or a tab")}</strong>
            <span className="muted">
              {T(
                "The recording is made on your device and stays there until you save it.",
              )}
            </span>
            {supported ? (
              <button
                type="button"
                className="btn acc lg vt-start"
                disabled={phase === "asking"}
                onClick={() => void start()}
              >
                <Icon name="record" />
                {T("Start recording")}
              </button>
            ) : (
              <p className="note warn" role="alert">
                {T(
                  "This browser can't record the screen. Try Chrome, Edge, Firefox or Safari on a computer.",
                )}
              </p>
            )}
            {problem && (
              <p className="note warn vt-problem" role="alert">
                {problem}
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
              <dd className="vt-elapsed">
                {phase === "done" && take?.info
                  ? fmtTime(take.info.durationSec)
                  : fmtTime(elapsed / 1000, 0)}
              </dd>
            </div>
            <div>
              <dt>{T("Size")}</dt>
              <dd>
                {formatBytes(
                  take ? (take.mp4?.blob.size ?? take.file.size) : bytes,
                )}
              </dd>
            </div>
            <div>
              <dt>{T("Format")}</dt>
              <dd>{take ? (take.mp4 ? "MP4" : ext) : mp4 ? "MP4" : "WebM"}</dd>
            </div>
          </dl>
        </div>

        {recording && (
          <div className="vt-rec-ctl">
            {phase === "recording" && (
              <p className={`vt-rec-state${paused ? " paused" : ""}`}>
                <i aria-hidden="true" />
                {paused ? T("Paused") : T("Recording")}
              </p>
            )}
            {phase === "recording" &&
              (paused ? (
                <button
                  type="button"
                  className="btn vt-resume"
                  onClick={resume}
                >
                  <Icon name="play" />
                  {T("Resume")}
                </button>
              ) : (
                <button type="button" className="btn vt-pause" onClick={pause}>
                  <Icon name="pause" />
                  {T("Pause")}
                </button>
              ))}
            <button type="button" className="btn acc lg vt-stop" onClick={stop}>
              <Icon name="stop" />
              {T("Stop recording")}
            </button>
          </div>
        )}

        {phase === "done" && take && (
          <div
            className="vt-result"
            data-bytes={take.mp4?.blob.size ?? take.file.size}
          >
            <button
              type="button"
              className="btn primary vt-download"
              onClick={() =>
                take.mp4
                  ? downloadBlob(take.mp4.blob, take.mp4.name)
                  : downloadBlob(take.file, take.file.name)
              }
            >
              <Icon name="download" />
              {T("Download {ext}", { ext: take.mp4 ? "MP4" : ext! })}
            </button>
            {!take.mp4 &&
              ext === "WEBM" &&
              (converting ? (
                <div className="vt-progress" role="status">
                  <div className="vt-pline">
                    <span>{T(converting.stage)}</span>
                    <b>{Math.round(converting.ratio * 100)}%</b>
                  </div>
                  <span className="mp-bar">
                    <i
                      style={{
                        width: `${Math.round(converting.ratio * 100)}%`,
                      }}
                    />
                  </span>
                  <button
                    type="button"
                    className="btn vt-cancel"
                    onClick={() => convertCtl.current?.abort()}
                  >
                    <Icon name="x" />
                    {T("Cancel")}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn vt-to-mp4"
                    onClick={() => void toMp4()}
                  >
                    {T("Convert to MP4")}
                  </button>
                  <p className="muted vt-hint">
                    {T("MP4 plays on more phones and in more apps.")}
                  </p>
                </>
              ))}
            {take.mp4 && (
              <button
                type="button"
                className="btn sm"
                onClick={() => downloadBlob(take.file, take.file.name)}
              >
                {T("Download the WebM")}
              </button>
            )}
            <button
              type="button"
              className="btn vt-again"
              disabled={!!converting}
              onClick={() => {
                setTake(null);
                setPhase("idle");
                setElapsed(0);
                setBytes(0);
              }}
            >
              <Icon name="record" />
              {T("Record again")}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
