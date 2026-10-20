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
const MODE_KEY = "kmra-calc-mode";
const MEMORY_KEY = "kmra-calc-memory";
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

/**
 * Scientific keys: [label, insert, name] and, after 2nd, the same for the second function.
 * Inserts that start with ":" are actions rather than text.
 */
type SciKey = [label: string, insert: string, name: string, second?: [string, string, string]];

const SCI: SciKey[] = [
  ["2nd", ":2nd", "Second functions"],
  ["sin", "sin(", "Sine", ["sin⁻¹", "asin(", "Inverse sine"]],
  ["cos", "cos(", "Cosine", ["cos⁻¹", "acos(", "Inverse cosine"]],
  ["tan", "tan(", "Tangent", ["tan⁻¹", "atan(", "Inverse tangent"]],
  ["e", "e", "Euler's number"],
  ["sinh", "sinh(", "Hyperbolic sine", ["sinh⁻¹", "asinh(", "Inverse hyperbolic sine"]],
  ["cosh", "cosh(", "Hyperbolic cosine", ["cosh⁻¹", "acosh(", "Inverse hyperbolic cosine"]],
  ["tanh", "tanh(", "Hyperbolic tangent", ["tanh⁻¹", "atanh(", "Inverse hyperbolic tangent"]],
  ["log", "log(", "Logarithm, base 10", ["10ˣ", "10^", "Ten to the power"]],
  ["ln", "ln(", "Natural logarithm", ["eˣ", "e^", "e to the power"]],
  ["x³", "^3", "Cube", ["∛x", "∛(", "Cube root"]],
  ["ʸ√x", " root ", "Root of any degree"],
  ["1/x", ":inv", "Reciprocal"],
  ["|x|", "abs(", "Absolute value"],
  ["x!", "!", "Factorial"],
  ["nCr", " nCr ", "Combinations"],
  ["nPr", " nPr ", "Permutations"],
  ["mod", " mod ", "Remainder"],
  ["EE", "E", "Times ten to the power"],
  ["±", ":neg", "Change sign"],
  ["MC", ":mc", "Clear memory"],
  ["MR", ":mr", "Recall memory"],
  ["M+", ":m+", "Add to memory"],
  ["M−", ":m-", "Subtract from memory"],
  ["Ans", "ans", "Last answer"],
];

/** A number as text the calculator reads back exactly (negative ones in brackets) */
const asText = (v: number) => {
  const s = String(Number(v.toPrecision(15)));
  return v < 0 ? `(${s})` : s;
};

export default function Calculator({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const [expr, setExprState] = useState("");
  // The latest text, so keys pressed in quick succession build on each other, not on the last render
  const exprRef = useRef("");
  exprRef.current = expr;
  const setExpr = (v: string) => {
    exprRef.current = v;
    setExprState(v);
  };
  const [deg, setDeg] = useState(true);
  const [sci, setSci] = useState(preset?.mode === "scientific");
  const [second, setSecond] = useState(false);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<Entry[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    setHistory(store<Entry[]>(HISTORY_KEY, []).slice(0, 50));
    // A use-case page sets the mode; otherwise the last one picked comes back
    if (preset?.mode === undefined) setSci(store<string>(MODE_KEY, "basic") === "scientific");
    const m = store<number>(MEMORY_KEY, 0);
    setMemory(Number.isFinite(m) ? m : 0);
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

  function remember(v: number) {
    const next = Number(v.toPrecision(15));
    setMemory(next);
    save(MEMORY_KEY, next);
  }

  /** The number on screen: the live answer, or the last one shown */
  const current = () => (r.ok ? r.v : (last.current ?? 0));

  function pressSci(key: SciKey) {
    const insert = second && key[3] ? key[3][1] : key[1];
    if (insert === ":2nd") {
      setSecond(!second);
      return;
    }
    setSecond(false);
    setShown(null);
    const body = exprRef.current.trim();
    switch (insert) {
      case ":inv":
        setExpr(body ? `1/(${body})` : "1/");
        caret.current = null;
        restore(99);
        return;
      case ":neg": {
        const m = /^−\((.*)\)$/.exec(body);
        setExpr(m ? m[1]! : body ? `−(${body})` : "−");
        caret.current = null;
        restore(99);
        return;
      }
      case ":mc":
        remember(0);
        return;
      case ":m+":
        remember(memory + current());
        return;
      case ":m-":
        remember(memory - current());
        return;
      case ":mr":
        press(asText(memory));
        return;
    }
    press(insert);
  }

  /** Where keys insert: the field's selection when it shows the current text, else our own caret */
  const caret = useRef<number | null>(null);
  function selection(el: HTMLInputElement | null): [number, number] {
    const cur = exprRef.current;
    if (el && el.value === cur && el.selectionStart !== null && el.selectionEnd !== null)
      return [el.selectionStart, el.selectionEnd];
    const at = Math.min(caret.current ?? cur.length, cur.length);
    return [at, at];
  }

  function press(k: string) {
    const el = coarse() ? null : input.current;
    const cur = exprRef.current;
    setShown(null);
    if (k === "clear") {
      setExpr("");
      caret.current = 0;
    } else if (k === "back") {
      const [a, b] = selection(el);
      if (a !== b) {
        setExpr(cur.slice(0, a) + cur.slice(b));
        caret.current = a;
        restore(a);
      } else if (a > 0) {
        setExpr(cur.slice(0, a - 1) + cur.slice(a));
        caret.current = a - 1;
        restore(a - 1);
      }
      return;
    } else if (k === "=") {
      commit();
      caret.current = null;
    } else {
      const [a, b] = selection(el);
      setExpr(cur.slice(0, a) + k + cur.slice(b));
      caret.current = a + k.length;
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
      className={`calc-pad-card${sci ? " sci" : ""}`}
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
                      caret.current = null;
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
          <p>
            {T(
              "Scientific adds inverse and hyperbolic trig (press 2nd), powers of 10 and e, nCr and nPr, any root (27 root 3 = 3), 2E3 for 2 × 10³, and memory: M+ and M− add the answer on screen to the memory, MR puts it back in the sum.",
            )}
          </p>
        </How>
      }
    >
      <div className="calc-screen">
        {memory !== 0 && (
          <span className="calc-mem" title={T("Memory")}>
            M = {f.n(memory, 10)}
          </span>
        )}
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
            caret.current = null;
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
        <div className="seg sm" role="group" aria-label={T("Calculator mode")}>
          <button
            type="button"
            aria-pressed={!sci}
            onClick={() => {
              setSci(false);
              save(MODE_KEY, "basic");
            }}
          >
            {T("Basic")}
          </button>
          <button
            type="button"
            aria-pressed={sci}
            onClick={() => {
              setSci(true);
              save(MODE_KEY, "scientific");
            }}
          >
            {T("Scientific")}
          </button>
        </div>
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
      <div className={`calc-pads${sci ? " sci" : ""}`}>
      {sci && (
        <div className="calc-keys calc-sci" role="group" aria-label={T("Scientific keys")}>
          {SCI.map((key) => {
            const alt = second && key[3];
            const [label, , name] = alt ? key[3]! : key;
            return (
              <button
                key={key[0]}
                type="button"
                className={`fn${key[1] === ":2nd" ? " shift" : ""}${alt ? " alt" : ""}`}
                aria-label={T(name)}
                aria-pressed={key[1] === ":2nd" ? second : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pressSci(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
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
      </div>
    </CalcCard>
  );
}
