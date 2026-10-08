import { useEffect, useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarSeg,
  Pane,
  Workspace,
  textBytes,
  useInput,
  type PaneError,
} from "../lib/kit";
import { jsonError } from "../lib/json";

type From = "yaml" | "json";
type JsonIndent = 2 | 4 | "tab";
type Style = "block" | "flow";
type YamlLib = typeof import("yaml");

const SAMPLE_YAML = `# A small service config
name: kmra
version: 2
live: true
owner:
  site: kmra.dev
  since: 2026
tools:
  - json
  - base64
  - jwt
limits: { files: 20, size: 50MB }
notes: |
  Everything runs on your device.
  Comments like this one are dropped in JSON.
`;

const SAMPLE_JSON = `{"name":"kmra","version":2,"live":true,"owner":{"site":"kmra.dev","since":2026},"tools":["json","base64","jwt"],"empty":null}`;

export default function YamlJson({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("yaml-json");
  const [from, setFrom] = useState<From>(
    preset?.from === "json" ? "json" : "yaml",
  );
  const [jsonIndent, setJsonIndent] = useState<JsonIndent>(2);
  const [yamlIndent, setYamlIndent] = useState<2 | 4>(2);
  const [style, setStyle] = useState<Style>("block");
  const [lib, setLib] = useState<YamlLib | null>(null);

  // The YAML parser loads with the tool, not with the site
  useEffect(() => {
    let live = true;
    void import("yaml").then((m) => live && setLib(m));
    return () => {
      live = false;
    };
  }, []);

  const result = useMemo(() => {
    if (!input.trim() || !lib) return null;
    if (from === "yaml") {
      const docs = lib.parseAllDocuments(input);
      const list = Array.isArray(docs) ? docs : [docs];
      for (const d of list) {
        const err = d.errors[0];
        if (err) {
          const pos = err.linePos?.[0];
          return {
            ok: false as const,
            error: {
              message: yamlMessage(err.code, err.message),
              line: pos?.line,
              col: pos?.col,
            },
          };
        }
      }
      try {
        const values = list
          .filter((d) => d.contents !== null || list.length === 1)
          .map((d) => d.toJS({ maxAliasCount: 1000 }) as unknown);
        const v = values.length === 1 ? values[0] : values;
        return {
          ok: true as const,
          text: JSON.stringify(
            v ?? null,
            null,
            jsonIndent === "tab" ? "\t" : jsonIndent,
          ),
          docs: values.length,
        };
      } catch (e) {
        return {
          ok: false as const,
          error: { message: e instanceof Error ? e.message : String(e) },
        };
      }
    }
    try {
      const v = JSON.parse(input) as unknown;
      return {
        ok: true as const,
        text: lib.stringify(v, {
          indent: yamlIndent,
          collectionStyle: style === "flow" ? "flow" : "block",
          lineWidth: 0,
        }),
        docs: 1,
      };
    } catch (e) {
      return { ok: false as const, error: jsonError(input, e) };
    }
  }, [input, lib, from, jsonIndent, yamlIndent, style]);

  const error: PaneError | null =
    result && !result.ok
      ? { ...result.error, message: T(result.error.message) }
      : null;
  const output = result?.ok ? result.text : "";

  function swap() {
    if (!result?.ok) return;
    setInput(output);
    setFrom(from === "yaml" ? "json" : "yaml");
  }

  return (
    <Workspace
      bar={
        <>
          <BarSeg<From>
            label={T("Direction")}
            options={[
              ["yaml", T("YAML to JSON")],
              ["json", T("JSON to YAML")],
            ]}
            value={from}
            onPick={setFrom}
          />
          {from === "yaml" ? (
            <BarSeg<JsonIndent>
              label={T("Indent")}
              options={[
                [2, T("2 spaces")],
                [4, T("4 spaces")],
                ["tab", T("Tabs")],
              ]}
              value={jsonIndent}
              onPick={setJsonIndent}
            />
          ) : (
            <>
              <BarSeg<2 | 4>
                label={T("Indent")}
                options={[
                  [2, T("2 spaces")],
                  [4, T("4 spaces")],
                ]}
                value={yamlIndent}
                onPick={setYamlIndent}
              />
              <BarSeg<Style>
                label={T("Style")}
                options={[
                  ["block", T("Block")],
                  ["flow", T("Flow")],
                ]}
                value={style}
                onPick={setStyle}
              />
            </>
          )}
          {result?.ok && (
            <button type="button" className="btn xs" onClick={swap}>
              <Icon name="convert" />
              {T("Swap")}
            </button>
          )}
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() =>
                setInput(from === "yaml" ? SAMPLE_YAML : SAMPLE_JSON)
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
            {from === "yaml"
              ? T("Paste YAML to get JSON. Errors show the line and column.")
              : T("Paste JSON to get YAML.")}
          </span>
        ) : result.ok ? (
          <>
            <span className="ok">
              {from === "yaml" ? T("Valid YAML") : T("Valid JSON")}
            </span>
            {result.docs > 1 && (
              <span>
                {T("{n} documents, shown as an array", { n: result.docs })}
              </span>
            )}
            <span>
              {formatBytes(textBytes(input))} → {formatBytes(textBytes(output))}
            </span>
          </>
        ) : (
          <span className="bad">
            {from === "yaml" ? T("Invalid YAML") : T("Invalid JSON")}
          </span>
        )
      }
    >
      <Pane
        label={from === "yaml" ? "YAML" : "JSON"}
        value={input}
        onChange={setInput}
        placeholder={
          from === "yaml" ? T("Paste YAML here") : T("Paste JSON here")
        }
        error={error}
        file={
          from === "yaml"
            ? ".yaml,.yml,text/yaml,text/plain"
            : ".json,application/json,text/plain"
        }
      />
      <Pane
        label={from === "yaml" ? "JSON" : "YAML"}
        value={output}
        readOnly
        download={from === "yaml" ? "data.json" : "data.yaml"}
      />
    </Workspace>
  );
}

/** The yaml library's error codes in plain words (English; the tool translates them) */
function yamlMessage(code: string, raw: string): string {
  switch (code) {
    case "BAD_INDENT":
      return "The indentation is off. Line items up with their siblings.";
    case "TAB_AS_INDENT":
      return "YAML indents with spaces, not tabs.";
    case "MISSING_CHAR":
    case "UNEXPECTED_TOKEN":
      return "Something is missing or out of place here, such as a colon or a closing bracket.";
    case "MULTILINE_IMPLICIT_KEY":
      return "A key can't span lines. Check for a missing colon or quote.";
    case "DUPLICATE_KEY":
      return "This key appears twice in the same map.";
    case "BLOCK_AS_IMPLICIT_KEY":
      return "A key is followed by more indented content. Check the indentation.";
    case "BAD_ALIAS":
    case "BAD_SCALAR_START":
      return "This value can't start with that character. Put it in quotes.";
    case "ALIAS_PROPS":
    case "UNEXPECTED_ALIAS":
      return "An alias (*name) isn't valid here.";
    default:
      return raw.split("\n")[0]!.replace(/ at line \d+, column \d+.*$/, "");
  }
}
