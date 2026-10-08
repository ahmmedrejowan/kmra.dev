import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { CopyBtn } from "@kmra/ui/components/kit";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { useInput } from "../lib/kit";
import {
  CHEATSHEET,
  FLAGS,
  READY,
  SAMPLE_TEXT,
  explain,
  splitByMatches,
  type RegexJob,
  type RegexResult,
} from "../lib/regex";

type Tab = "matches" | "replace" | "explain" | "cheats";

/** Longest a match run may take before the worker is stopped */
const LIMIT_MS = 1000;
/** Matches listed (all of them are highlighted) */
const LIST_MAX = 500;

const ORDER = "dgimsuvy";

function makeWorker() {
  return new Worker(new URL("../lib/regex.worker.ts", import.meta.url), {
    type: "module",
  });
}

export default function RegexTester({ preset }: ToolProps) {
  const T = useT();
  const [pattern, setPattern] = useState(
    typeof preset?.pattern === "string" ? preset.pattern : "",
  );
  const [flags, setFlags] = useState(
    typeof preset?.flags === "string" ? preset.flags : "g",
  );
  const [text, setText] = useInput("regex-tester");
  const [replace, setReplace] = useState("");
  const [tab, setTab] = useState<Tab>("matches");
  const [res, setRes] = useState<RegexResult | null>(null);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(-1);

  const worker = useRef<Worker | null>(null);
  const job = useRef(0);
  const running = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const back = useRef<HTMLDivElement>(null);

  // Errors in the pattern or flags show at once (building a RegExp doesn't run it)
  const compileError = useMemo(() => {
    if (!pattern) return null;
    try {
      new RegExp(pattern, flags);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [pattern, flags]);

  useEffect(() => () => worker.current?.terminate(), []);

  useEffect(() => {
    if (!pattern || compileError) {
      job.current++;
      setRes(null);
      setSlow(false);
      setBusy(false);
      return;
    }
    const id = ++job.current;
    let limit: ReturnType<typeof setTimeout> | undefined;
    let spin: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(() => {
      // A run still going is stuck on an older input; drop it
      if (running.current) {
        worker.current?.terminate();
        worker.current = null;
      }
      const w = (worker.current ??= makeWorker());
      w.onmessage = (e: MessageEvent<RegexResult>) => {
        if (e.data.id !== job.current) return;
        clearTimeout(limit);
        clearTimeout(spin);
        running.current = false;
        setBusy(false);
        setSlow(false);
        setRes(e.data);
      };
      running.current = true;
      const msg: RegexJob = {
        id,
        pattern,
        flags,
        text,
        replace: tab === "replace" ? replace : null,
      };
      w.postMessage(msg);
      spin = setTimeout(() => setBusy(true), 150);
      limit = setTimeout(() => {
        if (id !== job.current || !running.current) return;
        w.terminate();
        worker.current = null;
        running.current = false;
        setBusy(false);
        setRes(null);
        setSlow(true);
      }, LIMIT_MS);
    }, 120);
    return () => {
      clearTimeout(start);
      clearTimeout(spin);
      // The limit keeps running only for the job that's current
    };
  }, [pattern, flags, text, replace, tab, compileError]);

  useEffect(() => setCur(-1), [res]);

  const ok = res?.ok ? res : null;
  const matches = ok?.matches ?? [];
  const pieces = useMemo(() => splitByMatches(text, matches), [text, matches]);
  const parts = useMemo(
    () => (pattern ? explain(pattern, flags) : []),
    [pattern, flags],
  );

  function toggle(f: string) {
    let next = flags.includes(f) ? flags.replace(f, "") : flags + f;
    // u and v can't be used together
    if (f === "u" && next.includes("u")) next = next.replace("v", "");
    if (f === "v" && next.includes("v")) next = next.replace("u", "");
    setFlags(
      [...next].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(""),
    );
  }

  function sync(e: UIEvent<HTMLTextAreaElement>) {
    if (back.current) {
      back.current.scrollTop = e.currentTarget.scrollTop;
      back.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  function select(n: number) {
    const m = matches[n];
    const t = area.current;
    setCur(n);
    if (!m || !t) return;
    t.focus();
    t.setSelectionRange(m.index, m.end);
  }

  const names = useMemo(() => groupNames(pattern), [pattern]);
  const literal = `/${pattern}/${flags}`;

  return (
    <div className="devcard">
      <div className="dev-bar">
        <div className="bar-item">
          <span className="bar-label">{T("Flags")}</span>
          <div className="seg sm rx-flags" role="group" aria-label={T("Flags")}>
            {FLAGS.map(({ f, name }) => (
              <button
                key={f}
                type="button"
                aria-pressed={flags.includes(f)}
                title={T(name)}
                aria-label={`${f}: ${T(name)}`}
                onClick={() => toggle(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="bar-item rx-ready">
          <span className="bar-label">{T("Ready patterns")}</span>
          {READY.map((r) => (
            <button
              key={r.name}
              type="button"
              className="btn xs"
              onClick={() => {
                setPattern(r.pattern);
                setFlags(r.flags);
                if (!text) setText(SAMPLE_TEXT);
              }}
            >
              {T(r.name)}
            </button>
          ))}
        </div>
      </div>
      <div className={`rx-pattern${compileError ? " bad" : ""}`}>
        <label className="rx-field">
          <span className="rx-slash" aria-hidden="true">
            /
          </span>
          <input
            className="rx-input"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={T("Type a regular expression, e.g. \\d+")}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label={T("Pattern")}
          />
          <span className="rx-slash" aria-hidden="true">
            /{flags}
          </span>
        </label>
        {pattern && (
          <CopyBtn
            text={literal}
            label={T("Copy pattern")}
            className="btn xs"
          />
        )}
        {compileError && (
          <p className="rx-error" role="alert">
            {T("This pattern isn't valid: {m}", {
              m: compileError.replace(/^Invalid regular expression: /, ""),
            })}
          </p>
        )}
      </div>
      <div className="dev-panes c2">
        <section className="pane">
          <header className="pane-head">
            <span className="pane-label">{T("Test text")}</span>
            <span className="pane-acts">
              {!text && (
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => setText(SAMPLE_TEXT)}
                >
                  {T("Try a sample")}
                </button>
              )}
              {text && (
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => setText("")}
                >
                  {T("Clear")}
                </button>
              )}
            </span>
          </header>
          <div className="rx-text">
            <div className="rx-back" ref={back} aria-hidden="true">
              {pieces.map((p, i) =>
                p.m === undefined ? (
                  <span key={i}>{p.text}</span>
                ) : (
                  <mark
                    key={i}
                    className={`${p.m % 2 ? "b" : "a"}${p.m === cur ? " cur" : ""}${p.text ? "" : " empty"}`}
                  >
                    {p.text}
                  </mark>
                ),
              )}
              {"\n"}
            </div>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={sync}
              placeholder={T("Paste text to test the pattern on")}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={T("Test text")}
            />
          </div>
        </section>
        <section className="pane">
          <header className="pane-head">
            <div className="seg sm" role="group" aria-label={T("Show")}>
              {(
                [
                  ["matches", T("Matches")],
                  ["replace", T("Replace")],
                  ["explain", T("Explanation")],
                  ["cheats", T("Cheat sheet")],
                ] as [Tab, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={tab === v}
                  onClick={() => setTab(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </header>
          <div className="dev-list rx-side">
            {tab === "matches" &&
              (slow ? (
                <SlowNote />
              ) : !pattern ? (
                <p className="dev-note">
                  {T("Type a pattern to see its matches.")}
                </p>
              ) : compileError ? (
                <p className="dev-note">
                  {T("Fix the pattern to see matches.")}
                </p>
              ) : !ok ? (
                <p className="dev-note">{T("Matching…")}</p>
              ) : !matches.length ? (
                <p className="dev-note">{T("No matches.")}</p>
              ) : (
                <ol className="rx-matches">
                  {matches.slice(0, LIST_MAX).map((m, n) => (
                    <li key={n} className={n === cur ? "cur" : ""}>
                      <button
                        type="button"
                        className="rx-m"
                        onClick={() => select(n)}
                      >
                        <span className="rx-n">{n + 1}</span>
                        <code className="rx-val">{m.text || T("(empty)")}</code>
                        <span className="rx-at">
                          {T("index {a}–{b}", { a: m.index, b: m.end })}
                        </span>
                      </button>
                      {(m.groups.length > 0 || m.named.length > 0) && (
                        <dl className="rx-groups">
                          {m.groups.map((g) => {
                            const name = names.get(g.n);
                            return (
                              <div key={g.n}>
                                <dt>
                                  ${g.n}
                                  {name && (
                                    <span className="rx-name">
                                      {" "}
                                      &lt;{name}&gt;
                                    </span>
                                  )}
                                </dt>
                                <dd>
                                  {g.value === undefined ? (
                                    <span className="muted">
                                      {T("no match")}
                                    </span>
                                  ) : (
                                    <code>{g.value || T("(empty)")}</code>
                                  )}
                                  {g.span && (
                                    <span className="rx-at">
                                      {T("index {a}–{b}", {
                                        a: g.span[0],
                                        b: g.span[1],
                                      })}
                                    </span>
                                  )}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </li>
                  ))}
                </ol>
              ))}
            {tab === "replace" && (
              <div className="rx-replace">
                <label className="dev-field">
                  {T("Replace with")}
                  <input
                    className="dev-input mono"
                    value={replace}
                    onChange={(e) => setReplace(e.target.value)}
                    placeholder={T("e.g. [$1] or $<name>")}
                    spellCheck={false}
                    aria-label={T("Replace with")}
                  />
                </label>
                <p className="dev-note rx-hint">
                  {T(
                    "$1 is the first group, $<name> a named group, $& the whole match.",
                  )}
                </p>
                {slow ? (
                  <SlowNote />
                ) : ok?.replaced != null ? (
                  <>
                    <div className="rx-out-head">
                      <span className="pane-label">{T("Result")}</span>
                      <CopyBtn text={ok.replaced} className="btn xs" />
                    </div>
                    <pre className="rx-out" aria-label={T("Result")}>
                      {ok.replaced}
                    </pre>
                  </>
                ) : (
                  <p className="dev-note">
                    {!pattern
                      ? T("Type a pattern to see its matches.")
                      : compileError
                        ? T("Fix the pattern to see matches.")
                        : T("Matching…")}
                  </p>
                )}
              </div>
            )}
            {tab === "explain" &&
              (!parts.length ? (
                <p className="dev-note">
                  {T("Type a pattern to see what each part means.")}
                </p>
              ) : (
                <>
                  <ol className="rx-explain">
                    {parts.map((p, n) => (
                      <li key={n} style={{ paddingLeft: 14 + p.depth * 18 }}>
                        <code>{p.code}</code>
                        <span>
                          {T(p.key, p.vars)}
                          {p.q && (
                            <>
                              {", "}
                              {T(p.q.key, p.q.vars)}
                              {p.q.lazy && T(", as few as possible")}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="dev-note">
                    {T(
                      "This reads the pattern one part at a time. How the parts work together shows in the matches.",
                    )}
                  </p>
                </>
              ))}
            {tab === "cheats" && (
              <dl className="rx-cheats">
                {CHEATSHEET.map(([code, what]) => (
                  <div key={code}>
                    <dt>
                      <code>{code}</code>
                    </dt>
                    <dd>{T(what)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      </div>
      <div className="dev-status" aria-live="polite">
        {slow ? (
          <span className="bad">{T("Stopped: the pattern took too long")}</span>
        ) : compileError ? (
          <span className="bad">{T("Invalid pattern")}</span>
        ) : busy ? (
          <span>{T("Matching…")}</span>
        ) : ok ? (
          <>
            <span className={matches.length ? "ok" : ""}>
              {matches.length === 1
                ? T("1 match")
                : T("{n} matches", { n: matches.length.toLocaleString() })}
              {ok.capped
                ? " " + T("(stopped at {n})", { n: matches.length })
                : ""}
            </span>
            {matches.length > LIST_MAX && tab === "matches" && (
              <span>{T("First {n} listed", { n: LIST_MAX })}</span>
            )}
            <span>
              {T("{n} ms", { n: ok.ms < 1 ? "<1" : Math.round(ok.ms) })}
            </span>
          </>
        ) : (
          <span>{T("Matching runs on your device, in the background.")}</span>
        )}
      </div>
    </div>
  );
}

function SlowNote() {
  const T = useT();
  return (
    <p className="dev-note bad" role="alert">
      {T(
        "This pattern took longer than a second on this text, so it was stopped. Nested repeats like (a+)+ can take exponentially long; try a more specific pattern.",
      )}
    </p>
  );
}

/** Group numbers of named groups: count the capturing groups that open before each */
function groupNames(pattern: string): Map<number, string> {
  const out = new Map<number, string>();
  let n = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "[") {
      // Skip a class
      for (i++; i < pattern.length && pattern[i] !== "]"; i++)
        if (pattern[i] === "\\") i++;
      continue;
    }
    if (c !== "(") continue;
    if (pattern[i + 1] !== "?") {
      n++;
      continue;
    }
    const m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(pattern.slice(i));
    if (m) out.set(++n, m[1]!);
  }
  return out;
}
