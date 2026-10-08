import { useEffect, useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { BarSeg, Pane, Workspace } from "../lib/kit";
import { takeText } from "../lib/handoff";
import {
  htmlEscape,
  htmlUnescape,
  type EntityScope,
  type EntityStyle,
} from "../lib/encode";
import { entityNames } from "../lib/entities";

type Mode = "escape" | "unescape";

const SAMPLE = {
  escape: `<p class="note">Fish & chips for 5 € — "café" special</p>`,
  unescape:
    "&lt;p&gt;Fish &amp; chips for 5 &euro; &mdash; &quot;caf&eacute;&quot; special &#128031;&lt;/p&gt;",
};

export default function HtmlEntities({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "escape");
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<EntityScope>("minimal");
  const [style, setStyle] = useState<EntityStyle>("named");

  // Text from the home page's smart paste has entities in it
  useEffect(() => {
    const t = takeText("html-entities");
    if (t !== null) {
      setInput(t);
      setMode("unescape");
    }
  }, []);

  const result = useMemo(() => {
    if (!input) return null;
    return mode === "escape"
      ? htmlEscape(
          input,
          scope,
          style,
          style === "named" ? entityNames() : null,
        )
      : htmlUnescape(input);
  }, [input, mode, scope, style]);
  const output = result?.text ?? "";

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
              <BarSeg<EntityScope>
                label={T("Characters")}
                options={[
                  ["minimal", T("Only & < > \" '")],
                  ["nonascii", T("Also non-ASCII")],
                ]}
                value={scope}
                onPick={setScope}
              />
              <BarSeg<EntityStyle>
                label={T("Style")}
                options={[
                  ["named", T("Named")],
                  ["decimal", T("Decimal")],
                  ["hex", T("Hex")],
                ]}
                value={style}
                onPick={setStyle}
              />
            </>
          )}
          {result && (
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
              ? T("Paste text to make it safe to put in HTML.")
              : T("Paste HTML with entities like &amp; or &#233; to read it.")}
          </span>
        ) : (
          <>
            <span className="ok">
              {mode === "escape"
                ? T("{n} characters escaped", { n: result.count })
                : T("{n} entities decoded", { n: result.count })}
            </span>
            <span>
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
        label={mode === "escape" ? T("Text") : T("HTML")}
        value={input}
        onChange={setInput}
        placeholder={
          mode === "escape"
            ? T("Type or paste text")
            : T("Paste HTML with entities")
        }
        file=".html,.htm,.xml,.txt,text/*"
        wrap
      />
      <Pane
        label={mode === "escape" ? T("Escaped") : T("Unescaped")}
        value={output}
        readOnly
        wrap
        download={mode === "escape" ? "escaped.html" : "unescaped.txt"}
      />
    </Workspace>
  );
}
