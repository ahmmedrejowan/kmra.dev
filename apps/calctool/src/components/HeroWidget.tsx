import { useState } from "react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLang, useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { tryEval } from "../lib/expr";
import { HANDOFF_KEY, useFmt } from "../lib/ui";

const TRY = {
  en: ["12% of 250", "(4 + 6) × 2.5", "√144", "1500 − 15%"],
  // "of" is an English word, so the Bangla page tries a plain multiplication instead
  bn: ["250 × 12%", "(4 + 6) × 2.5", "√144", "1500 − 15%"],
};

/** The home page's hero: a small live calculator, with a way into the full one. */
function Mini() {
  const T = useT();
  const f = useFmt();
  const lp = useLp();
  const lang = useLang();
  const [expr, setExpr] = useState("");
  const r = tryEval(expr);
  const full = lp("/calculator");

  function open() {
    try {
      if (expr.trim()) sessionStorage.setItem(HANDOFF_KEY, expr);
    } catch {
      // storage blocked: the calculator just opens empty
    }
  }

  return (
    <div className="calc-mini">
      <div className="calc-mini-row">
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && expr.trim()) {
              open();
              location.href = full;
            }
          }}
          placeholder={T("Type a sum, like 12% of 250")}
          aria-label={T("Sum")}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          enterKeyHint="go"
        />
        <output
          className={`calc-mini-ans${r.ok ? "" : " dim"}`}
          data-value={r.ok ? String(r.v) : undefined}
          aria-live="polite"
        >
          = {r.ok ? f.n(r.v, 10) : f.n(0)}
        </output>
      </div>
      <div className="calc-mini-foot">
        <div className="calc-mini-try">
          <span>{T("Try")}</span>
          {TRY[lang].map((s) => (
            <button key={s} type="button" onClick={() => setExpr(f.d(s))}>
              {f.d(s)}
            </button>
          ))}
        </div>
        <a className="btn sm acc" href={full} onClick={open}>
          <Icon name="calculator" />
          {T("Open the full calculator")}
        </a>
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
