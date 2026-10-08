import { useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
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
import { countText, processLines, type Order } from "../lib/lines";

const SAMPLE = `banana
Apple
cherry
apple
item 10
item 2

banana
  date  `;

const ORDERS: Order[] = [
  "none",
  "az",
  "za",
  "natural",
  "length",
  "reverse",
  "shuffle",
];

export default function LineTools({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("line-tools");
  const [order, setOrder] = useState<Order>(
    ORDERS.find((o) => o === preset?.order) ?? "none",
  );
  const [trim, setTrim] = useState(preset?.trim === true);
  const [dropEmpty, setDropEmpty] = useState(preset?.dropEmpty === true);
  const [dedupe, setDedupe] = useState(preset?.dedupe === true);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [number, setNumber] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [splitBy, setSplitBy] = useState("");
  const [joinWith, setJoinWith] = useState("");
  const [round, setRound] = useState(0);

  const out = useMemo(
    () =>
      processLines(
        input,
        {
          order,
          trim,
          dropEmpty,
          dedupe,
          ignoreCase,
          number,
          prefix,
          suffix,
          splitBy,
          joinWith,
        },
        round,
      ),
    [
      input,
      order,
      trim,
      dropEmpty,
      dedupe,
      ignoreCase,
      number,
      prefix,
      suffix,
      splitBy,
      joinWith,
      round,
    ],
  );
  const c = useMemo(() => countText(input), [input]);
  const minutes = c.readMinutes;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Order>
            label={T("Order")}
            options={[
              ["none", T("Keep")],
              ["az", T("A–Z")],
              ["za", T("Z–A")],
              ["natural", T("Natural")],
              ["length", T("By length")],
              ["reverse", T("Reverse")],
              ["shuffle", T("Shuffle")],
            ]}
            value={order}
            onPick={setOrder}
          />
          {order === "shuffle" && (
            <button
              type="button"
              className="btn xs"
              onClick={() => setRound((r) => r + 1)}
            >
              <Icon name="shuffle" />
              {T("Shuffle again")}
            </button>
          )}
          <BarCheck label={T("Trim each line")} on={trim} onChange={setTrim} />
          <BarCheck
            label={T("Remove empty lines")}
            on={dropEmpty}
            onChange={setDropEmpty}
          />
          <BarCheck
            label={T("Remove duplicates")}
            on={dedupe}
            onChange={setDedupe}
          />
          <BarCheck
            label={T("Ignore case")}
            on={ignoreCase}
            onChange={setIgnoreCase}
          />
          <BarCheck
            label={T("Number lines")}
            on={number}
            onChange={setNumber}
          />
          <BarField
            label={T("Prefix")}
            value={prefix}
            onChange={setPrefix}
            width={70}
          />
          <BarField
            label={T("Suffix")}
            value={suffix}
            onChange={setSuffix}
            width={70}
          />
          <BarField
            label={T("Split at")}
            value={splitBy}
            onChange={setSplitBy}
            width={70}
            placeholder=", or \t"
          />
          <BarField
            label={T("Join with")}
            value={joinWith}
            onChange={setJoinWith}
            width={70}
            placeholder={T("New line")}
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
        <>
          <span data-count="chars">
            {T("{n} characters", { n: c.chars.toLocaleString() })}
          </span>
          <span data-count="nospace">
            {T("{n} without spaces", { n: c.charsNoSpaces.toLocaleString() })}
          </span>
          <span data-count="words">
            {T("{n} words", { n: c.words.toLocaleString() })}
          </span>
          <span data-count="lines">
            {T("{n} lines", { n: c.lines.toLocaleString() })}
          </span>
          <span data-count="sentences">
            {T("{n} sentences", { n: c.sentences.toLocaleString() })}
          </span>
          <span data-count="paragraphs">
            {T("{n} paragraphs", { n: c.paragraphs.toLocaleString() })}
          </span>
          <span data-count="read">
            {minutes === 0
              ? T("No reading time")
              : minutes < 1
                ? T("Under a minute to read")
                : T("{n} min read", { n: Math.round(minutes) })}
          </span>
          {input && (
            <span className="ok" data-count="result">
              {T("Result: {n} lines", { n: out.lines.toLocaleString() })}
              {dedupe && out.removed > 0
                ? `, ${out.removed === 1 ? T("1 duplicate removed") : T("{n} duplicates removed", { n: out.removed })}`
                : ""}
            </span>
          )}
        </>
      }
    >
      <Pane
        label={T("Text")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste lines of text")}
        file
      />
      <Pane
        label={T("Result")}
        value={out.text}
        readOnly
        download="lines.txt"
      />
    </Workspace>
  );
}
