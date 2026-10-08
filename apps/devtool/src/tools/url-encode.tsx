import { useEffect, useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { BarCheck, BarSeg, Pane, Workspace, type PaneError } from "../lib/kit";
import { takeText } from "../lib/handoff";
import {
  DecodeError,
  lineCol,
  percentDecode,
  percentEncode,
  type UrlPart,
} from "../lib/encode";

type Mode = "encode" | "decode";

const SAMPLE = {
  encode: "name=Zoë & friends/2026?ok=yes",
  decode:
    "https://example.com/search?q=caf%C3%A9+au+lait&tags=%F0%9F%8D%B0%2Cdessert",
};

export default function UrlEncode({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "encode");
  const [input, setInput] = useState("");
  const [part, setPart] = useState<UrlPart>("component");
  const [plus, setPlus] = useState(false);
  const [plusIn, setPlusIn] = useState(true);
  const [lines, setLines] = useState(false);

  // Text from the home page's smart paste is percent-encoded
  useEffect(() => {
    const t = takeText("url-encode");
    if (t !== null) {
      setInput(t);
      setMode("decode");
    }
  }, []);

  const result = useMemo(() => {
    if (!input) return null;
    // Line by line keeps each line's own encoding; offsets still point into the whole input
    const chunks = lines ? input.split("\n") : [input];
    const out: string[] = [];
    let offset = 0;
    let valid = true;
    let escapes = 0;
    try {
      for (const c of chunks) {
        try {
          if (mode === "encode")
            out.push(percentEncode(c, part, part === "component" && plus));
          else {
            const d = percentDecode(c, part, plusIn);
            out.push(d.text);
            valid &&= d.valid;
            escapes += d.escapes;
          }
        } catch (e) {
          if (e instanceof DecodeError && e.index !== undefined)
            e.index += offset;
          throw e;
        }
        offset += c.length + 1;
      }
    } catch (e) {
      if (!(e instanceof DecodeError)) throw e;
      return { ok: false as const, error: e };
    }
    const text = out.join("\n");
    if (mode === "encode")
      escapes = (text.match(/%[0-9a-f]{2}/gi) ?? []).length;
    return { ok: true as const, text, valid, escapes };
  }, [input, mode, part, plus, plusIn, lines]);

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

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Direction")}
            options={[
              ["encode", T("Encode")],
              ["decode", T("Decode")],
            ]}
            value={mode}
            onPick={setMode}
          />
          <BarSeg<UrlPart>
            label={T("Treat as")}
            options={[
              ["component", T("Part of a URL")],
              ["uri", T("Full URL")],
            ]}
            value={part}
            onPick={setPart}
          />
          {mode === "encode" && part === "component" && (
            <BarCheck label={T("Spaces as +")} on={plus} onChange={setPlus} />
          )}
          {mode === "decode" && (
            <BarCheck
              label={T("+ means space")}
              on={plusIn}
              onChange={setPlusIn}
            />
          )}
          <BarCheck label={T("Line by line")} on={lines} onChange={setLines} />
          {result?.ok && (
            <button
              type="button"
              className="btn xs"
              onClick={() => {
                setInput(output);
                setMode(mode === "encode" ? "decode" : "encode");
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
            {mode === "encode"
              ? T("Type text to percent-encode it for a URL.")
              : T("Paste an encoded URL or text to decode it.")}
          </span>
        ) : !result.ok ? (
          <span className="bad">{T("Can't convert this text")}</span>
        ) : (
          <>
            <span className="ok">
              {mode === "encode" ? T("Encoded") : T("Decoded")}
            </span>
            {!result.valid && (
              <span className="bad">
                {T("Some bytes aren't valid UTF-8 and show as �")}
              </span>
            )}
            <span>
              {T("{n} escapes", { n: result.escapes })},{" "}
              {T("{a} → {b} characters", {
                a: input.length,
                b: output.length,
              })}
            </span>
          </>
        )
      }
    >
      <Pane
        label={mode === "encode" ? T("Text") : T("Encoded")}
        value={input}
        onChange={setInput}
        placeholder={
          mode === "encode"
            ? T("Type or paste text")
            : T("Paste a URL or encoded text")
        }
        error={error}
        wrap
      />
      <Pane
        label={mode === "encode" ? T("Encoded") : T("Decoded")}
        value={output}
        readOnly
        wrap
      />
    </Workspace>
  );
}
