import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarSeg, Pane, Workspace, useInput } from "../lib/kit";
import {
  CronError,
  FIELD_LABEL,
  allowed,
  describe,
  englishNth,
  fieldValues,
  fieldWords,
  nextRuns,
  parseCron,
  splitFields,
  usesOrRule,
  type DowMode,
  type Words,
} from "../lib/cron";
import { iso, offsetText, relative } from "../lib/time";

const EXAMPLES: [string, string][] = [
  ["*/15 9-17 * * 1-5", "Every 15 minutes in working hours"],
  ["0 0 * * *", "Every day at midnight"],
  ["0 9 * * MON", "Mondays at 9"],
  ["0 0 1 * *", "First of every month"],
  ["30 2 * * 0", "Sundays at 02:30"],
  ["0 0 L * ?", "Last day of every month"],
  ["0 */10 * * * *", "Every 10 minutes, with seconds"],
  ["@hourly", "Every hour"],
];

function zones(): string[] {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {}
  return [...new Set([here, "UTC", ...all])];
}

export default function CronExplainer({ preset }: ToolProps) {
  const T = useT();
  const lang = useLang();
  const loc = lang === "bn" ? "bn-BD" : undefined;
  const wordLoc = lang === "bn" ? "bn-BD" : "en";
  const [input, setInput] = useInput(
    "cron-explainer",
    typeof preset?.cron === "string" ? preset.cron : "*/15 9-17 * * 1-5",
  );
  const [mode, setMode] = useState<DowMode>("unix");
  const [tz, setTz] = useState("UTC");
  const [tzList, setTzList] = useState<string[]>(["UTC"]);
  // "Now" only exists in the browser
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const list = zones();
    setTzList(list);
    setTz(list[0]!);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const words: Words = useMemo(() => {
    const mf = new Intl.DateTimeFormat(wordLoc, {
      month: "long",
      timeZone: "UTC",
    });
    const df = new Intl.DateTimeFormat(wordLoc, {
      weekday: "long",
      timeZone: "UTC",
    });
    return {
      t: T,
      nth: (n) => (lang === "en" ? englishNth(n) : String(n)),
      month: (n) => mf.format(Date.UTC(2000, n - 1, 1)),
      // 1 January 2023 was a Sunday
      day: (n) => df.format(Date.UTC(2023, 0, 1 + n)),
    };
    // T changes identity every render; the language is what matters
  }, [lang, wordLoc]);

  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, cron: parseCron(input, mode) };
    } catch (e) {
      if (!(e instanceof CronError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input, mode]);

  const cron = parsed?.ok ? parsed.cron : null;
  const err = parsed && !parsed.ok ? parsed.error : null;
  const errText = err
    ? T(err.message, {
        ...err.vars,
        field: err.field ? T(FIELD_LABEL[err.field]) : "",
      })
    : "";

  const next = useMemo(
    () => (cron && now !== null ? nextRuns(cron, now, tz, 10) : null),
    [cron, now, tz],
  );

  const { tokens, ids } = splitFields(input);
  const withSeconds = !!cron?.get.second;
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(loc, {
        timeZone: tz,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        hourCycle: "h23",
      }),
    [loc, tz, withSeconds],
  );
  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(loc, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [loc],
  );

  const zoneName = tz.replace(/_/g, " ");
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Workspace
      bar={
        <>
          <label className="bar-item">
            <span className="bar-label">{T("Time zone")}</span>
            <select
              className="bar-input"
              value={tz}
              aria-label={T("Time zone")}
              onChange={(e) => setTz(e.target.value)}
            >
              {tzList.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <BarSeg<DowMode>
            label={T("Day numbers")}
            options={[
              ["unix", T("0 is Sunday")],
              ["quartz", T("1 is Sunday (Quartz)")],
            ]}
            value={mode}
            onPick={setMode}
          />
        </>
      }
      status={
        !parsed ? (
          <span>{T("Type a cron expression.")}</span>
        ) : cron ? (
          <>
            <span className="ok">
              {cron.reboot
                ? T("Valid macro")
                : cron.macro
                  ? T("Valid, {macro} is {expr}", {
                      macro: cron.macro,
                      expr: cron.fields.map((f) => f.raw).join(" "),
                    })
                  : T("Valid, {n} fields", { n: cron.fields.length })}
            </span>
            {usesOrRule(cron) && (
              <span>
                {T(
                  "Day of month and day of week are both set, so it runs when either one matches.",
                )}
              </span>
            )}
          </>
        ) : (
          <span className="bad">{errText}</span>
        )
      }
    >
      <Pane
        label={T("Expression")}
        value={input}
        onChange={setInput}
        error={err ? { message: errText } : null}
      >
        <div className="dev-list">
          <div className="dev-form">
            <label className="dev-field">
              <span>{T("Cron expression")}</span>
              <input
                className="dev-input mono cron-in"
                value={input}
                placeholder="*/15 9-17 * * 1-5"
                aria-label={T("Cron expression")}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                onChange={(e) => setInput(e.target.value)}
              />
            </label>
            <p className="cron-say" aria-live="polite">
              {cron ? describe(cron, words) : err ? "" : " "}
            </p>
            <div className="chips cron-examples">
              {EXAMPLES.map(([ex, what]) => (
                <button
                  key={ex}
                  type="button"
                  title={T(what)}
                  aria-pressed={input.trim() === ex}
                  onClick={() => setInput(ex)}
                >
                  <code>{ex}</code>
                </button>
              ))}
            </div>
          </div>
          {tokens.length > 0 && (
            <table className="cron-fields">
              <thead>
                <tr>
                  <th>{T("Field")}</th>
                  <th>{T("Value")}</th>
                  <th>{T("Means")}</th>
                  <th>{T("Allowed")}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((tok, i) => {
                  const id = ids?.[i];
                  const f = cron?.fields[i];
                  const bad = err?.index === i;
                  const vals = f ? fieldValues(f, words) : "";
                  return (
                    <tr
                      key={i}
                      className={bad ? "bad" : undefined}
                      data-field={id}
                    >
                      <th scope="row">{id ? T(FIELD_LABEL[id]) : i + 1}</th>
                      <td>
                        <code>{tok}</code>
                      </td>
                      <td>
                        {f ? (
                          <>
                            {fieldWords(f, mode, words)}
                            {vals && !f.star && (
                              <small className="cron-vals">{vals}</small>
                            )}
                          </>
                        ) : bad ? (
                          errText
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="muted">{id ? allowed(id, mode) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="dev-note">
            {T(
              "Five fields: minute, hour, day of month, month, day of week. Six fields add seconds at the start, seven add a year at the end. * means every, a-b a range, */n every nth, and lists use commas.",
            )}
          </p>
        </div>
      </Pane>
      <Pane
        label={T("Next runs in {zone}", { zone: zoneName })}
        value={next ? next.runs.map((r) => iso(r.ms, tz)).join("\n") : ""}
        readOnly
      >
        <div className="dev-list">
          {cron?.reboot ? (
            <p className="dev-rows-empty">
              {T(
                "@reboot runs once when the cron service starts, so it has no schedule.",
              )}
            </p>
          ) : !cron || !next ? (
            <p className="dev-rows-empty">
              {err
                ? T("Fix the expression to see the next runs.")
                : T("The next 10 run times appear here.")}
            </p>
          ) : next.runs.length === 0 ? (
            <p className="dev-rows-empty">
              <span className="bad">
                {T("This expression never runs. Check the day and month.")}
              </span>
            </p>
          ) : (
            <ol className="cron-runs">
              {(() => {
                const out: ReactNode[] = [];
                const last = next.runs.at(-1)!.ms;
                let si = 0;
                next.runs.forEach((r, i) => {
                  // Skipped times (clocks went forward) that fall before this run
                  while (si < next.skips.length) {
                    const s = next.skips[si]!;
                    const day = Date.UTC(s.y, s.mo - 1, s.d);
                    const runDay = Date.UTC(r.wall.y, r.wall.mo - 1, r.wall.d);
                    if (day > runDay || day > last) break;
                    const t = (w: typeof s.first) => `${pad(w.h)}:${pad(w.mi)}`;
                    const at = `${dayFmt.format(day)}, ${t(s.first)}${
                      s.count > 1 ? `–${t(s.last)}` : ""
                    }`;
                    out.push(
                      <li key={`skip${si}`} className="cron-skip">
                        {s.count > 1
                          ? T(
                              "{when}: {n} runs skipped, those times don't exist because the clocks go forward",
                              { when: at, n: s.count },
                            )
                          : T(
                              "{when}: skipped, that time doesn't exist because the clocks go forward",
                              { when: at },
                            )}
                      </li>,
                    );
                    si++;
                  }
                  const prev = next.runs[i - 1];
                  const shift = prev && prev.offset !== r.offset;
                  out.push(
                    <li
                      key={r.ms}
                      data-iso={iso(r.ms, tz)}
                      className={shift ? "shift" : undefined}
                    >
                      <span className="cron-n">{i + 1}</span>
                      <span className="cron-when">{when.format(r.ms)}</span>
                      <span className="cron-off">
                        UTC{offsetText(r.offset)}
                        {shift && <em>{T("Clocks changed")}</em>}
                      </span>
                      <span className="cron-rel">
                        {now !== null ? relative(r.ms, now, loc) : ""}
                      </span>
                    </li>,
                  );
                });
                return out;
              })()}
            </ol>
          )}
          <p className="dev-note">
            {T(
              "Times are worked out in {zone}. When the clocks go forward, times that don't exist are skipped; when they go back, a repeated time runs once.",
              { zone: zoneName },
            )}
          </p>
        </div>
      </Pane>
    </Workspace>
  );
}
