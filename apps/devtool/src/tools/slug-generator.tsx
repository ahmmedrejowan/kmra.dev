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
} from "../lib/kit";
import { slugify, type Separator } from "../lib/slug";

const SAMPLE = `Héllo Wörld — 2026!
10 Tips for Faster JavaScript & CSS
Ça va? Crème brûlée à la carte
Straße nach Øresund
Привет, мир`;

export default function SlugGenerator({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("slug-generator");
  const [sep, setSep] = useState<Separator>(
    preset?.separator === "_" || preset?.separator === "."
      ? preset.separator
      : "-",
  );
  const [lower, setLower] = useState(preset?.lower !== false);
  const [maxRaw, setMaxRaw] = useState("");
  const [stop, setStop] = useState(false);
  const max = Math.max(0, Math.floor(Number(maxRaw) || 0));

  const lines = useMemo(
    () => (input ? input.replace(/\r\n?/g, "\n").split("\n") : []),
    [input],
  );
  const slugs = useMemo(
    () =>
      lines.map((l) =>
        slugify(l, { separator: sep, lower, maxLength: max, stopWords: stop }),
      ),
    [lines, sep, lower, max, stop],
  );
  const output = slugs.join("\n");
  const titled = lines.filter((l) => l.trim()).length;
  const empty = lines.filter((l, i) => l.trim() && !slugs[i]).length;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Separator>
            label={T("Separator")}
            options={[
              ["-", T("Hyphen -")],
              ["_", T("Underscore _")],
              [".", T("Dot .")],
            ]}
            value={sep}
            onPick={setSep}
          />
          <BarSeg<boolean>
            label={T("Case")}
            options={[
              [true, T("Lowercase")],
              [false, T("Keep case")],
            ]}
            value={lower}
            onPick={setLower}
          />
          <BarField
            label={T("Max length")}
            type="number"
            min={0}
            width={70}
            value={maxRaw}
            onChange={setMaxRaw}
            placeholder={T("None")}
          />
          <BarCheck
            label={T("Remove stop words")}
            on={stop}
            onChange={setStop}
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
        !input ? (
          <span>{T("One slug per line. Accents become plain letters.")}</span>
        ) : (
          <>
            <span className="ok">
              {titled - empty === 1
                ? T("1 slug")
                : T("{n} slugs", { n: titled - empty })}
            </span>
            {max > 0 && (
              <span>
                {T("Cut at whole words, up to {n} characters", { n: max })}
              </span>
            )}
            {empty > 0 && (
              <span className="bad">
                {T("{n} lines have no letters that can be spelled in Latin", {
                  n: empty,
                })}
              </span>
            )}
          </>
        )
      }
    >
      <Pane
        label={T("Titles")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste titles, one per line")}
        file
      />
      <Pane label={T("Slugs")} value={output} readOnly download="slugs.txt" />
    </Workspace>
  );
}
