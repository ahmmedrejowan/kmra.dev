import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { tryEval } from "../lib/expr";
import {
  CalcCard,
  CopyIcon,
  HANDOFF_KEY,
  How,
  save,
  store,
  useFmt,
} from "../lib/ui";

interface Entry {
  expr: string;
  v: number;
}

const HISTORY_KEY = "kmra-calc-history";
/** On touch screens the keypad shouldn't pop up the phone's keyboard */
const coarse = () => {
  try {
    return matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
};

type Key = [
  label: string,
  insert: string,
  kind?: "fn" | "op" | "eq",
  name?: string,
];

// Five columns: functions on the left, digits in the middle, operators on the right
const KEYS: Key[] = [
  ["(", "(", "fn"],
  [")", ")", "fn"],
  ["%", "%", "fn"],
  ["AC", "clear", "fn", "Clear"],
  ["⌫", "back", "fn", "Delete"],
  ["√", "√", "fn", "Square root"],
  ["7", "7"],
  ["8", "8"],
  ["9", "9"],
  ["÷", "÷", "op", "Divide"],
  ["x²", "^2", "fn", "Square"],
  ["4", "4"],
  ["5", "5"],
  ["6", "6"],
  ["×", "×", "op", "Multiply"],
  ["xʸ", "^", "fn", "Power"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
  ["−", "−", "op", "Subtract"],
  ["π", "π", "fn", "Pi"],
  ["0", "0"],
  [".", "."],
  ["=", "=", "eq", "Equals"],
  ["+", "+", "op", "Add"],
];

export default function Calculator(_: ToolProps) {
  const T = useT();
  const f = useFmt();
  const [expr, setExpr] = useState("");
  const [deg, setDeg] = useState(true);
  const [history, setHistory] = useState<Entry[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    setHistory(store<Entry[]>(HISTORY_KEY, []).slice(0, 50));
    try {
      const h = sessionStorage.getItem(HANDOFF_KEY);
      if (h) {
        sessionStorage.removeItem(HANDOFF_KEY);
        setExpr(h);
      }
    } catch {
      // storage blocked: start empty
    }
  }, []);

  const ans = history[0]?.v ?? 0;
  const r = tryEval(expr, { deg, ans });
  if (r.ok) last.current = r.v;
  const live = r.ok ? f.n(r.v, 10) : null;

  function commit() {
    if (!r.ok) {
      setShown(T(r.message, r.vars));
      return;
    }
    const entry = { expr: expr.trim(), v: r.v };
    const next = [entry, ...history.filter((h) => h.expr !== entry.expr)].slice(
      0,
      50,
    );
    setHistory(next);
    save(HISTORY_KEY, next);
    setExpr(String(Number(r.v.toPrecision(15))));
    setShown(null);
  }

  function press(k: string) {
    const el = coarse() ? null : input.current;
    setShown(null);
    if (k === "clear") {
      setExpr("");
    } else if (k === "back") {
      const a = el?.selectionStart ?? expr.length;
      const b = el?.selectionEnd ?? expr.length;
      if (a !== b) setExpr(expr.slice(0, a) + expr.slice(b));
      else if (a > 0) {
        setExpr(expr.slice(0, a - 1) + expr.slice(a));
        restore(a - 1);
      }
      return;
    } else if (k === "=") {
      commit();
    } else {
      const a = el?.selectionStart ?? expr.length;
      const b = el?.selectionEnd ?? expr.length;
      setExpr(expr.slice(0, a) + k + expr.slice(b));
      restore(a + k.length);
      return;
    }
    el?.focus();
  }

  function restore(pos: number) {
    if (coarse()) return;
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const message =
    shown ?? (!r.ok && !r.incomplete ? T(r.message, r.vars) : null);

  return (
    <CalcCard
      className="calc-pad-card"
      result={
        <div className="calc-history">
          <div className="calc-sub-head">
            <h3>{T("History")}</h3>
            {history.length > 0 && (
              <button
                type="button"
                className="btn xs"
                onClick={() => {
                  setHistory([]);
                  save(HISTORY_KEY, []);
                }}
              >
                {T("Clear history")}
              </button>
            )}
          </div>
          {history.length ? (
            <ol aria-label={T("History")}>
              {history.map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    title={T("Use this answer")}
                    onClick={() => {
                      setExpr(String(Number(h.v.toPrecision(15))));
                      setShown(null);
                      restore(99);
                    }}
                  >
                    <span>{h.expr} =</span>
                    <strong>{f.n(h.v, 10)}</strong>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="calc-note">
              {T(
                "Press = or Enter to keep an answer here. Click one to use it again.",
              )}
            </p>
          )}
        </div>
      }
      below={
        <How title={T("Good to know")}>
          <p>
            {T(
              "200 + 10% adds 10% of 200 (220). 12% of 250 works too. Angles are in degrees unless you pick radians.",
            )}
          </p>
          <p>
            {T(
              "Also: sqrt, cbrt, sin, cos, tan, log, ln, abs, 5! and ans (the last answer). Enter keeps the answer, Esc clears.",
            )}
          </p>
        </How>
      }
    >
      <div className="calc-screen">
        <input
          ref={input}
          value={expr}
          aria-label={T("Sum")}
          placeholder={T("Type a sum, like 12% of 250")}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          enterKeyHint="done"
          name="expr"
          onChange={(e) => {
            setExpr(e.target.value);
            setShown(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "=" && !e.shiftKey)) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setExpr("");
              setShown(null);
            }
          }}
        />
        <output
          className={`calc-answer${live ? "" : " dim"}`}
          data-value={r.ok ? String(r.v) : undefined}
          aria-live="polite"
        >
          {live ??
            (last.current !== null && expr ? f.n(last.current, 10) : f.n(0))}
        </output>
        <span className="calc-msg" role="status">
          {message}
        </span>
      </div>
      <div className="calc-sub-head">
        <div className="seg sm" role="group" aria-label={T("Angles")}>
          <button type="button" aria-pressed={deg} onClick={() => setDeg(true)}>
            {T("Degrees")}
          </button>
          <button
            type="button"
            aria-pressed={!deg}
            onClick={() => setDeg(false)}
          >
            {T("Radians")}
          </button>
        </div>
        {live && <CopyIcon text={live} what={T("Answer")} />}
      </div>
      <div className="calc-keys">
        {KEYS.map(([label, k, kind, name]) => (
          <button
            key={label}
            type="button"
            className={kind}
            aria-label={name ? T(name) : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => press(k)}
          >
            {k === "back" ? <Icon name="back" /> : label}
          </button>
        ))}
      </div>
    </CalcCard>
  );
}
