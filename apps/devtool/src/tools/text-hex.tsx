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
  bytesTo,
  fromUtf8,
  guessFmt,
  lineCol,
  parseBytes,
  utf8,
  type ByteFmt,
  type ByteSep,
} from "../lib/encode";

type Mode = "encode" | "decode";
type Sep = "space" | "none" | "comma" | "line";
const SEP: Record<Sep, ByteSep> = {
  space: " ",
  none: "",
  comma: ", ",
  line: "\n",
};

const SAMPLE = "Hi 👋 é";

export default function TextHex({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "encode");
  const [input, setInput] = useInput("text-hex");
  const [fmt, setFmt] = useState<ByteFmt>((preset?.format as ByteFmt) ?? "hex");
  const [readAs, setReadAs] = useState<ByteFmt | "auto">("auto");
  const [sep, setSep] = useState<Sep>("space");
  const [prefix, setPrefix] = useState(false);
  const [upper, setUpper] = useState(false);

  const result = useMemo(() => {
    if (!input) return null;
    try {
      if (mode === "encode") {
        const bytes = utf8(input);
        return {
          ok: true as const,
          bytes,
          text: bytesTo(bytes, fmt, { sep: SEP[sep], prefix, upper }),
          valid: true,
          read: fmt,
        };
      }
      const read = readAs === "auto" ? guessFmt(input) : readAs;
      const bytes = parseBytes(input, read);
      const d = fromUtf8(bytes);
      return { ok: true as const, bytes, text: d.text, valid: d.valid, read };
    } catch (e) {
      if (!(e instanceof DecodeError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input, mode, fmt, readAs, sep, prefix, upper]);

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
  const FMTS: [ByteFmt, string][] = [
    ["hex", T("Hex")],
    ["bin", T("Binary")],
    ["dec", T("Decimal")],
  ];
  const names: Record<ByteFmt, string> = Object.fromEntries(FMTS) as Record<
    ByteFmt,
    string
  >;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Direction")}
            options={[
              ["encode", T("Text to bytes")],
              ["decode", T("Bytes to text")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "encode" ? (
            <>
              <BarSeg<ByteFmt>
                label={T("Format")}
                options={FMTS}
                value={fmt}
                onPick={setFmt}
              />
              <BarSeg<Sep>
                label={T("Separator")}
                options={[
                  ["space", T("Space")],
                  ["comma", T("Comma")],
                  ["line", T("New line")],
                  ["none", T("None")],
                ]}
                value={sep}
                onPick={setSep}
              />
              {fmt === "hex" && (
                <>
                  <BarCheck
                    label={T("0x prefix")}
                    on={prefix}
                    onChange={setPrefix}
                  />
                  <BarCheck
                    label={T("Uppercase")}
                    on={upper}
                    onChange={setUpper}
                  />
                </>
              )}
            </>
          ) : (
            <BarSeg<ByteFmt | "auto">
              label={T("Read as")}
              options={[["auto", T("Detect")], ...FMTS]}
              value={readAs}
              onPick={setReadAs}
            />
          )}
          {result?.ok && (
            <button
              type="button"
              className="btn xs"
              onClick={() => {
                if (mode === "encode") {
                  setReadAs(fmt);
                  setMode("decode");
                } else {
                  setFmt(result.read);
                  setMode("encode");
                }
                setInput(output);
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
              onClick={() =>
                setInput(
                  mode === "encode" ? SAMPLE : bytesTo(utf8(SAMPLE), "hex"),
                )
              }
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
              ? T("Type text to see its UTF-8 bytes.")
              : T(
                  "Paste bytes in hex, binary or decimal. Spaces, commas and 0x are fine.",
                )}
          </span>
        ) : !result.ok ? (
          <span className="bad">{T("Can't read these bytes")}</span>
        ) : (
          <>
            {mode === "decode" && (
              <span className="ok">
                {T("Read as {f}", { f: names[result.read] })}
              </span>
            )}
            {!result.valid && (
              <span className="bad">
                {T("Some bytes aren't valid UTF-8 and show as �")}
              </span>
            )}
            <span>
              {T("{n} characters", {
                n: [...(mode === "encode" ? input : output)].length,
              })}
              , {T("{n} bytes", { n: result.bytes.length })}
            </span>
          </>
        )
      }
    >
      <Pane
        label={mode === "encode" ? T("Text") : T("Bytes")}
        value={input}
        onChange={setInput}
        placeholder={
          mode === "encode"
            ? T("Type or paste text")
            : T("Paste hex, binary or decimal bytes")
        }
        error={error}
        wrap
      />
      <Pane
        label={mode === "encode" ? names[fmt] : T("Text")}
        value={output}
        readOnly
        wrap
      />
    </Workspace>
  );
}
