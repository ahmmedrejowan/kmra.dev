import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { Pane, Workspace, useInput } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";

/**
 * Split a name or phrase into words: at spaces and punctuation, at lower→upper steps
 * (userID → user ID) and before the last capital of an acronym (XMLHttp → XML Http).
 * Digits stay with the letters before them (version2Beta → version2 Beta).
 */
export function words(s: string): string[] {
  return s
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const low = (w: string) => w.toLowerCase();
const up = (w: string) => w.toUpperCase();
const cap = (w: string) => up(w.slice(0, 1)) + low(w.slice(1));

type Case = {
  id: string;
  label: string;
  conv: (w: string[]) => string;
};

export const CASES: Case[] = [
  {
    id: "camel",
    label: "camelCase",
    conv: (w) => w.map((x, i) => (i ? cap(x) : low(x))).join(""),
  },
  { id: "pascal", label: "PascalCase", conv: (w) => w.map(cap).join("") },
  { id: "snake", label: "snake_case", conv: (w) => w.map(low).join("_") },
  { id: "kebab", label: "kebab-case", conv: (w) => w.map(low).join("-") },
  { id: "constant", label: "CONSTANT_CASE", conv: (w) => w.map(up).join("_") },
  { id: "title", label: "Title Case", conv: (w) => w.map(cap).join(" ") },
  {
    id: "sentence",
    label: "Sentence case",
    conv: (w) => w.map((x, i) => (i ? low(x) : cap(x))).join(" "),
  },
  { id: "lower", label: "lower case", conv: (w) => w.map(low).join(" ") },
  { id: "upper", label: "UPPER CASE", conv: (w) => w.map(up).join(" ") },
  { id: "dot", label: "dot.case", conv: (w) => w.map(low).join(".") },
  { id: "path", label: "path/case", conv: (w) => w.map(low).join("/") },
  { id: "train", label: "Train-Case", conv: (w) => w.map(cap).join("-") },
];

const SAMPLE =
  "XMLHttpRequest\nuserID\nversion2Beta\nalready_snake_case\nHello world, again";

export default function CaseConverter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("case-converter");
  const lines = input.split("\n");
  const rows: Row[] = input.trim()
    ? CASES.map((c) => ({
        id: c.id,
        label: T(c.label),
        value: lines.map((l) => c.conv(words(l))).join("\n"),
        on: c.id === preset?.case,
      }))
    : [];
  const count = lines.filter((l) => l.trim()).length;

  return (
    <Workspace
      bar={
        <>
          <span className="bar-item bar-label">
            {T("Each line is converted on its own.")}
          </span>
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
        input.trim() ? (
          <span>{T(count === 1 ? "{n} line" : "{n} lines", { n: count })}</span>
        ) : (
          <span>{T("Paste names or text to see every case.")}</span>
        )
      }
    >
      <Pane
        label={T("Text")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste names or text, one per line")}
        file
      />
      <Pane
        label={T("Cases")}
        value={rows.map((r) => r.value).join("\n\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows
            rows={rows}
            empty={
              <span>
                {T(
                  "camelCase, snake_case, kebab-case and nine more appear here.",
                )}
              </span>
            }
          />
        </div>
      </Pane>
    </Workspace>
  );
}
