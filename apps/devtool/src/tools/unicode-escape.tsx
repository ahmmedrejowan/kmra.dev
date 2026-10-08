import { useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarSeg,
  Pane,
  Workspace,
  useInput,
  type PaneError,
} from "../lib/kit";
import {
  DecodeError,
  lineCol,
  loneSurrogate,
  uEscape,
  uUnescape,
  type UStyle,
} from "../lib/encode";

type Mode = "escape" | "unescape";

const SAMPLE = {
  escape: "Café ☕ costs 3 €, ¡olé! 👋",
  unescape:
    "Caf\\u00E9 \\u2615 costs 3 \\u20AC, \\u00A1ol\\u00E9! \\uD83D\\uDC4B",
};

export default function UnicodeEscape({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "escape");
  const [input, setInput] = useInput("unicode-escape");
  const [style, setStyle] = useState<UStyle>("u");
  const [all, setAll] = useState(false);
  const [upper, setUpper] = useState(true);

  const result = useMemo(() => {
    if (!input) return null;
    try {
      if (mode === "escape") {
        const bad = loneSurrogate(input);
        if (bad >= 0)
          throw new DecodeError(
            "The text has a broken character (half of an emoji or symbol)",
            bad,
          );
        return {
          ok: true as const,
          text: uEscape(input, style, { all, upper }),
          count: 0,
        };
      }
      const u = uUnescape(input);
      return { ok: true as const, ...u };
    } catch (e) {
      if (!(e instanceof DecodeError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input, mode, style, all, upper]);

  const error: PaneError | null =
    result && !result.ok
      ? {
          message:
            T(result.error.message) +
            (result.error.detail ? ` “${result.error.detail}”` : ""),
          ...(result.error.index !== undefined
            ? lineCol(input, result.error.index)
            : {}),
        }
      : null;
  const output = result?.ok ? result.text : "";
  const text = mode === "escape" ? input : output;
  const points = [...text].length;
  const astral = [...text].filter((c) => c.length === 2).length;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Direction")}
            options={[
              ["escape", T("Escape")],
              ["unescape", T("Unescape")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "escape" && (
            <>
              <BarSeg<UStyle>
                label={T("Style")}
                options={[
                  ["u", "\\uXXXX"],
                  ["ubrace", "\\u{…}"],
                  ["codepoint", "U+XXXX"],
                  ["json", T("JSON string")],
                  ["html", "&#x…;"],
                ]}
                value={style}
                onPick={setStyle}
              />
              {style !== "codepoint" && (
                <BarCheck
                  label={T("Escape ASCII too")}
                  on={all}
                  onChange={setAll}
                />
              )}
              <BarCheck
                label={T("Uppercase hex")}
                on={upper}
                onChange={setUpper}
              />
            </>
          )}
          {result?.ok && (
            <button
              type="button"
              className="btn xs"
              onClick={() => {
                setInput(output);
                setMode(mode === "escape" ? "unescape" : "escape");
              }}
            >
              <Icon name="convert" />
              {T("Swap")}
            </button>
          )}
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setInput(SAMPLE[mode])}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>
            {mode === "escape"
              ? T("Type text to turn it into escapes.")
              : T(
                  "Paste \\u, \\u{…}, U+, \\x or &#…; escapes to read them. Every form works at once.",
                )}
          </span>
        ) : !result.ok ? (
          <span className="bad">{T("Can't convert this text")}</span>
        ) : (
          <>
            <span className="ok">
              {mode === "escape"
                ? T("Escaped")
                : T("{n} escapes read", { n: result.count })}
            </span>
            <span>
              {T("{n} characters", { n: points })}
              {astral > 0 &&
                `, ${T("{n} outside the basic plane (emoji and rare symbols)", { n: astral })}`}
            </span>
          </>
        )
      }
    >
      <Pane
        label={mode === "escape" ? T("Text") : T("Escapes")}
        value={input}
        onChange={setInput}
        placeholder={
          mode === "escape" ? T("Type or paste text") : T("Paste escaped text")
        }
        error={error}
        wrap
      />
      <Pane
        label={mode === "escape" ? T("Escapes") : T("Text")}
        value={output}
        readOnly
        wrap
      />
    </Workspace>
  );
}
