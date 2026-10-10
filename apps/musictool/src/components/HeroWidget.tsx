import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { clampBpm, defaultAccents, type MetroSettings } from "../lib/metronome";
import { useMetronome } from "../lib/useMetronome";
import { tempoName } from "../lib/theory";
import { useNum } from "../lib/ui";
import "../music.css";

/** Home page hero: a small working metronome, and a way into the tuner. */
function Mini() {
  const T = useT();
  const L = useLp();
  const num = useNum();
  const [bpm, setBpm] = useState(96);
  const [beats, setBeats] = useState(4);
  const settings = useMemo<MetroSettings>(
    () => ({
      bpm,
      beats,
      unit: 4,
      accents: defaultAccents(beats, 4),
      sub: 1,
      sound: "click",
      volume: 0.8,
      trainer: { on: false, step: 0, every: 0, max: 0 },
    }),
    [bpm, beats],
  );
  const m = useMetronome(settings);
  // Stop when the page is hidden for good (navigating away)
  useEffect(() => {
    const off = () => m.stop();
    window.addEventListener("pagehide", off);
    return () => window.removeEventListener("pagehide", off);
  }, []);

  return (
    <div className={`mt-mini${m.running ? " on" : ""}`}>
      <div className="mt-mini-main">
        <div className="mt-mini-tempo">
          <button type="button" className="mt-round sm" aria-label={T("Slower")} onClick={() => setBpm(clampBpm(bpm - 4))}>
            <Icon name="minus" />
          </button>
          <div className="mt-mini-bpm" data-value={bpm}>
            <output aria-live="polite">{num(bpm)}</output>
            <span>
              BPM · {T(tempoName(bpm))}
            </span>
          </div>
          <button type="button" className="mt-round sm" aria-label={T("Faster")} onClick={() => setBpm(clampBpm(bpm + 4))}>
            <Icon name="plus" />
          </button>
        </div>
        <div className="mt-mini-dots" aria-hidden="true">
          {settings.accents.map((a, i) => (
            <span key={i} className={`${a === 2 ? "acc" : ""}${m.now?.beat === i ? " on" : ""}`} />
          ))}
        </div>
        <button type="button" className={`btn lg mt-mini-go${m.running ? "" : " acc"}`} onClick={m.toggle}>
          <Icon name={m.running ? "stop" : "play"} />
          {m.running ? T("Stop") : T("Start the metronome")}
        </button>
      </div>
      <div className="mt-mini-foot">
        <div className="seg mt-mini-sig" role="group" aria-label={T("Beats per bar")}>
          {[2, 3, 4, 6].map((b) => (
            <button key={b} type="button" aria-pressed={beats === b} onClick={() => setBeats(b)}>
              {num(b)}/{num(4)}
            </button>
          ))}
        </div>
        <span className="mt-mini-links">
          <a className="btn sm" href={L("/metronome")}>
            <Icon name="metronome" />
            {T("Full metronome")}
          </a>
          <a className="btn sm acc" href={L("/tuner")}>
            <Icon name="gauge" />
            {T("Open the tuner")}
          </a>
        </span>
      </div>
    </div>
  );
}

export default function HeroWidget({ lang = "en" }: { lang?: Locale }) {
  return (
    <LangProvider lang={lang}>
      <Mini />
    </LangProvider>
  );
}
