import { useEffect, useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarCheck, BarField, BarSeg, Pane, Workspace } from "../lib/kit";
import { pick, randomInt } from "../lib/random";

type Unit = "paragraphs" | "sentences" | "words";
type Format = "plain" | "html";

const WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut " +
  "labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris " +
  "nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse " +
  "cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui " +
  "officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar " +
  "sapien vitae mauris suspendisse potenti viverra justo nec ultrices dui porta lectus sagittis " +
  "faucibus vestibulum mattis ullamcorper morbi tristique senectus netus malesuada fames ac " +
  "turpis egestas integer feugiat scelerisque varius quam pellentesque habitant arcu cursus " +
  "euismod blandit volutpat maecenas accumsan lacinia purus semper eget duis at tellus mi " +
  "ipsum faucibus vitae aliquet nec gravida neque convallis a cras placerat orci nulla " +
  "facilisi etiam dignissim diam quis risus ultricies tristique nibh sed odio massa tempus " +
  "iaculis urna molestie fermentum leo vel hendrerit dapibus augue eros donec ornare"
).split(" ");

const OPENING = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";
const LIMITS: Record<Unit, number> = {
  paragraphs: 50,
  sentences: 200,
  words: 2000,
};

const between = (lo: number, hi: number) => lo + randomInt(hi - lo + 1);
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function sentence(): string {
  const n = between(6, 15);
  const w = Array.from({ length: n }, () => pick(WORDS));
  // A comma in some of the longer sentences
  if (n > 8 && randomInt(2)) w[between(3, n - 4)] += ",";
  return cap(w.join(" ")) + ".";
}

function sentences(n: number, lorem: boolean): string[] {
  const out = Array.from({ length: n }, sentence);
  if (lorem && n) out[0] = OPENING + ".";
  return out;
}

function make(unit: Unit, n: number, lorem: boolean): string[] {
  if (unit === "words") {
    const w = Array.from({ length: n }, () => pick(WORDS));
    if (lorem) {
      const open = OPENING.replace(",", "").split(" ");
      w.splice(0, Math.min(n, open.length), ...open.slice(0, n));
    }
    if (w.length) w[0] = cap(w[0]!);
    return [w.join(" ")];
  }
  if (unit === "sentences") return [sentences(n, lorem).join(" ")];
  return Array.from({ length: n }, (_, i) =>
    sentences(between(4, 7), lorem && i === 0).join(" "),
  );
}

export default function LoremIpsum({ preset }: ToolProps) {
  const T = useT();
  const [unit, setUnit] = useState<Unit>(
    (["paragraphs", "sentences", "words"] as const).find(
      (u) => u === preset?.unit,
    ) ?? "paragraphs",
  );
  const [countRaw, setCountRaw] = useState("3");
  const [lorem, setLorem] = useState(true);
  const [format, setFormat] = useState<Format>(
    preset?.format === "html" ? "html" : "plain",
  );
  const [round, setRound] = useState(0);
  const n = Math.floor(Number(countRaw));
  const count = Number.isFinite(n) ? Math.min(LIMITS[unit], Math.max(1, n)) : 1;

  // Random text is made in the browser only (after hydration)
  useEffect(() => setRound(1), []);
  const blocks = useMemo(
    () => (round ? make(unit, count, lorem) : []),
    [round, unit, count, lorem],
  );
  const text =
    format === "html"
      ? blocks.map((b) => `<p>${b}</p>`).join("\n\n")
      : blocks.join("\n\n");
  const words = blocks.join(" ").split(/\s+/).filter(Boolean).length;

  return (
    <Workspace
      cols={1}
      bar={
        <>
          <BarSeg<Unit>
            label={T("Make")}
            options={[
              ["paragraphs", T("Paragraphs")],
              ["sentences", T("Sentences")],
              ["words", T("Words")],
            ]}
            value={unit}
            onPick={setUnit}
          />
          <BarField
            label={T("How many")}
            type="number"
            min={1}
            max={LIMITS[unit]}
            width={64}
            value={countRaw}
            onChange={setCountRaw}
          />
          <BarCheck
            label={T("Start with “Lorem ipsum”")}
            on={lorem}
            onChange={setLorem}
          />
          <BarSeg<Format>
            label={T("Format")}
            options={[
              ["plain", T("Plain text")],
              ["html", "HTML"],
            ]}
            value={format}
            onPick={setFormat}
          />
          <button
            type="button"
            className="btn xs bar-push"
            onClick={() => setRound((r) => r + 1)}
          >
            <Icon name="shuffle" />
            {T("Make new text")}
          </button>
        </>
      }
      status={
        <>
          <span>{T("{n} words", { n: words })}</span>
          <span>{T("{n} characters", { n: text.length })}</span>
        </>
      }
    >
      <Pane
        label={T("Placeholder text")}
        value={text}
        readOnly
        wrap
        download={format === "html" ? "lorem-ipsum.html" : "lorem-ipsum.txt"}
      />
    </Workspace>
  );
}
