import { useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarField,
  BarSeg,
  Pane,
  Workspace,
  useInput,
  type PaneError,
} from "../lib/kit";
import { jsonError } from "../lib/json";
import { jsonToTs, type TsOptions } from "../lib/jsonts";

const SAMPLE = `{
  "id": 42,
  "name": "kmra",
  "tags": ["json", "types"],
  "owner": { "login": "ada", "verified": true },
  "users": [
    { "id": 1, "email": "ada@example.com", "role": "admin" },
    { "id": 2, "email": null }
  ],
  "scores": [1, "n/a", 3.5]
}`;

export default function JsonToTypescript({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("json-to-typescript");
  const [style, setStyle] = useState<TsOptions["style"]>(
    preset?.style === "type" ? "type" : "interface",
  );
  const [exported, setExported] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const [root, setRoot] = useState("Root");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const v = JSON.parse(input) as unknown;
      const text = jsonToTs(v, { root, style, exported, readonly });
      const count = (text.match(/^(export )?(interface|type) /gm) ?? []).length;
      return { ok: true as const, text, count };
    } catch (e) {
      return { ok: false as const, error: jsonError(input, e) };
    }
  }, [input, root, style, exported, readonly]);

  const error: PaneError | null =
    result && !result.ok
      ? { ...result.error, message: T(result.error.message) }
      : null;

  return (
    <Workspace
      bar={
        <>
          <BarField
            label={T("Root name")}
            value={root}
            width={120}
            onChange={setRoot}
          />
          <BarSeg<TsOptions["style"]>
            label={T("Declare as")}
            options={[
              ["interface", "interface"],
              ["type", "type"],
            ]}
            value={style}
            onPick={setStyle}
          />
          <BarCheck label={T("Export")} on={exported} onChange={setExported} />
          <BarCheck
            label={T("Read-only")}
            on={readonly}
            onChange={setReadonly}
          />
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setInput(SAMPLE)}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>
            {T(
              "Paste a JSON sample. Arrays with several objects give the most accurate types.",
            )}
          </span>
        ) : result.ok ? (
          <span className="ok">{T("{n} types", { n: result.count })}</span>
        ) : (
          <span className="bad">{T("Invalid JSON")}</span>
        )
      }
    >
      <Pane
        label="JSON"
        value={input}
        onChange={setInput}
        placeholder={T("Paste JSON here")}
        error={error}
        file=".json,application/json,text/plain"
      />
      <Pane
        label="TypeScript"
        value={result?.ok ? result.text : ""}
        readOnly
        download="types.ts"
      />
    </Workspace>
  );
}
