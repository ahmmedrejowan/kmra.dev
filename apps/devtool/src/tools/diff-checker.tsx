import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as JsDiff from "diff";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn } from "@kmra/ui/components/kit";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarSeg,
  Pane,
  useOutName,
  downloadText,
  useInput,
  type PaneError,
} from "../lib/kit";
import { jsonError } from "../lib/json";
import {
  canonicalJson,
  diffTexts,
  sideRows,
  unifiedPatch,
  type Granularity,
  type Op,
  type Seg,
  type SideRow,
} from "../lib/diff";

type View = "side" | "inline";

const SAMPLE_A = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.
How vexingly quick daft zebras jump.
Sphinx of black quartz, judge my vow.`;
const SAMPLE_B = `The quick brown fox jumped over the lazy dog.
Pack my box with five dozen liquor jugs.
Sphinx of black quartz, judge my vow.
The five boxing wizards jump quickly.`;

/** Unchanged runs longer than this fold, keeping CONTEXT lines on each side */
const CONTEXT = 3;

export default function DiffChecker({ preset }: ToolProps) {
  const T = useT();
  const [a, setA] = useInput("diff-checker");
  const outName = useOutName();
  const [b, setB] = useState("");
  const [view, setView] = useState<View>(
    preset?.view === "inline" ? "inline" : "side",
  );
  const [gran, setGran] = useState<Granularity>(
    (["line", "word", "char"] as const).find((g) => g === preset?.by) ?? "word",
  );
  const [ignoreSpace, setIgnoreSpace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [json, setJson] = useState(preset?.json === true);
  const [lib, setLib] = useState<typeof JsDiff | null>(null);
  const [cur, setCur] = useState(-1);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const body = useRef<HTMLDivElement>(null);

  // jsdiff loads only on this page
  useEffect(() => {
    void import("diff").then(setLib);
  }, []);

  const da = useDeferredValue(a);
  const db = useDeferredValue(b);

  const prepared = useMemo(() => {
    if (!json) return { a: da, b: db, errA: null, errB: null };
    const one = (s: string) => {
      if (!s.trim()) return { text: "", err: null };
      try {
        return { text: canonicalJson(s), err: null };
      } catch (e) {
        return { text: "", err: jsonError(s, e) };
      }
    };
    const x = one(da);
    const y = one(db);
    return { a: x.text, b: y.text, errA: x.err, errB: y.err };
  }, [da, db, json]);

  const result = useMemo(() => {
    if (!lib || prepared.errA || prepared.errB) return null;
    if (!prepared.a && !prepared.b) return null;
    return diffTexts(lib, prepared.a, prepared.b, {
      granularity: gran,
      ignoreSpace,
      ignoreCase,
    });
  }, [lib, prepared, gran, ignoreSpace, ignoreCase]);

  const patch = useMemo(
    () => (result ? unifiedPatch(result.ops) : ""),
    [result],
  );

  // A new diff starts folded, before the first change
  useEffect(() => {
    setCur(-1);
    setOpen(new Set());
  }, [result]);

  function go(step: 1 | -1) {
    if (!result?.blocks.length) return;
    const n = result.blocks.length;
    const next = cur < 0 ? (step === 1 ? 0 : n - 1) : (cur + step + n) % n;
    setCur(next);
    const el = body.current?.querySelector(`[data-block="${next}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const err = (e: ReturnType<typeof jsonError> | null): PaneError | null =>
    e ? { ...e, message: T(e.message) } : null;

  const changes = result?.blocks.length ?? 0;
  const same = result && !changes;

  return (
    <div className="devcard">
      <div className="dev-bar">
        <BarSeg<View>
          label={T("View")}
          options={[
            ["side", T("Side by side")],
            ["inline", T("Inline")],
          ]}
          value={view}
          onPick={setView}
        />
        <BarSeg<Granularity>
          label={T("Highlight")}
          options={[
            ["line", T("Lines")],
            ["word", T("Words")],
            ["char", T("Characters")],
          ]}
          value={gran}
          onPick={setGran}
        />
        <BarCheck
          label={T("Ignore whitespace")}
          on={ignoreSpace}
          onChange={setIgnoreSpace}
        />
        <BarCheck
          label={T("Ignore case")}
          on={ignoreCase}
          onChange={setIgnoreCase}
        />
        <BarCheck label={T("Compare as JSON")} on={json} onChange={setJson} />
        {(a || b) && (
          <button
            type="button"
            className="btn xs"
            onClick={() => {
              setA(b);
              setB(a);
            }}
          >
            <Icon name="convert" />
            {T("Swap")}
          </button>
        )}
        {!a && !b && (
          <button
            type="button"
            className="btn xs bar-push"
            onClick={() => {
              if (json) {
                setA('{"name":"kmra","tools":3,"tags":["json","diff"]}');
                setB(
                  '{"tags":["json","diff","regex"],"name":"kmra","tools":4}',
                );
              } else {
                setA(SAMPLE_A);
                setB(SAMPLE_B);
              }
            }}
          >
            {T("Try a sample")}
          </button>
        )}
      </div>
      <div className="dev-panes c2 diff-in">
        <Pane
          label={T("Original")}
          value={a}
          onChange={setA}
          placeholder={T("Paste the original text")}
          error={err(prepared.errA)}
          file
        />
        <Pane
          label={T("Changed")}
          value={b}
          onChange={setB}
          placeholder={T("Paste the changed text")}
          error={err(prepared.errB)}
          file
        />
      </div>
      <section className="diff-out" aria-label={T("Differences")}>
        <header className="pane-head">
          <span className="pane-label">{T("Differences")}</span>
          <span className="pane-acts">
            {changes > 0 && (
              <>
                <span className="diff-pos" aria-live="polite">
                  {cur < 0
                    ? changes === 1
                      ? T("1 change")
                      : T("{n} changes", { n: changes })
                    : T("Change {i} of {n}", { i: cur + 1, n: changes })}
                </span>
                <button type="button" className="btn xs" onClick={() => go(-1)}>
                  {T("Previous change")}
                </button>
                <button type="button" className="btn xs" onClick={() => go(1)}>
                  {T("Next change")}
                </button>
                <CopyBtn
                  text={patch}
                  label={T("Copy patch")}
                  className="btn xs"
                />
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => downloadText(patch, outName("changes.patch"))}
                >
                  <Icon name="download" />
                  {T("Download")}
                </button>
              </>
            )}
          </span>
        </header>
        <div className="diff-body" ref={body}>
          {!result ? (
            <p className="dev-note">
              {prepared.errA || prepared.errB
                ? T("Fix the JSON to compare it.")
                : T("Paste two versions above. Changes show here as you type.")}
            </p>
          ) : same ? (
            <p className="dev-note diff-same">
              <Icon name="check" />
              {ignoreSpace || ignoreCase || json
                ? T("No differences with these settings.")
                : T("The two texts are identical.")}
            </p>
          ) : view === "side" ? (
            <SideView
              rows={sideRows(result.ops)}
              blocks={result.blocks}
              cur={cur}
              open={open}
              onOpen={(n) => setOpen((s) => new Set(s).add(n))}
            />
          ) : (
            <InlineView
              ops={result.ops}
              blocks={result.blocks}
              cur={cur}
              open={open}
              onOpen={(n) => setOpen((s) => new Set(s).add(n))}
            />
          )}
        </div>
      </section>
      <div className="dev-status" aria-live="polite">
        {!result ? (
          <span>
            {lib ? T("Compare two texts line by line.") : T("Loading…")}
          </span>
        ) : (
          <>
            <span className="diff-count add">
              {result.added === 1
                ? T("1 line added")
                : T("{n} lines added", { n: result.added })}
            </span>
            <span className="diff-count del">
              {result.removed === 1
                ? T("1 line removed")
                : T("{n} lines removed", { n: result.removed })}
            </span>
            <span>
              {T("{a} → {b} lines", {
                a: result.ops.filter((o) => o.t !== "add").length,
                b: result.ops.filter((o) => o.t !== "del").length,
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Segs({ op, side }: { op: Op; side: "a" | "b" }) {
  const text = side === "a" && op.other !== undefined ? op.other : op.text;
  if (!op.segs) return <>{text || " "}</>;
  return (
    <>
      {op.segs.map((s: Seg, i) =>
        s.hit ? (
          <mark key={i}>{s.text}</mark>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Which items to show: long unchanged runs fold to a "show N lines" button */
function fold<X>(
  items: X[],
  unchanged: (x: X) => boolean,
  open: Set<number>,
): (X | { fold: number; count: number })[] {
  const out: (X | { fold: number; count: number })[] = [];
  let k = 0;
  while (k < items.length) {
    if (!unchanged(items[k]!)) {
      out.push(items[k++]!);
      continue;
    }
    let end = k;
    while (end < items.length && unchanged(items[end]!)) end++;
    const keepHead = k === 0 ? 0 : CONTEXT;
    const keepTail = end === items.length ? 0 : CONTEXT;
    const hidden = end - k - keepHead - keepTail;
    if (hidden > 2 && !open.has(k)) {
      out.push(...items.slice(k, k + keepHead));
      out.push({ fold: k, count: hidden });
      out.push(...items.slice(end - keepTail, end));
    } else out.push(...items.slice(k, end));
    k = end;
  }
  return out;
}

const isFold = (x: object): x is { fold: number; count: number } => "fold" in x;

function FoldRow({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}): ReactNode {
  const T = useT();
  return (
    <button type="button" className="diff-fold" onClick={onOpen}>
      {T("Show {n} unchanged lines", { n: count })}
    </button>
  );
}

function SideView({
  rows,
  blocks,
  cur,
  open,
  onOpen,
}: {
  rows: SideRow[];
  blocks: number[];
  cur: number;
  open: Set<number>;
  onOpen: (n: number) => void;
}) {
  const blockAt = new Map(blocks.map((at, i) => [at, i]));
  const items = fold(rows, (r) => r.left?.t === "same", open);
  return (
    <div className="diff-side">
      {items.map((r) => {
        if (isFold(r))
          return (
            <FoldRow
              key={`f${r.fold}`}
              count={r.count}
              onOpen={() => onOpen(r.fold)}
            />
          );
        const block = r.left?.t === "same" ? undefined : blockAt.get(r.at);
        const L = r.left;
        const R = r.right;
        return (
          <div
            key={r.at}
            className={`diff-row${block === cur && block !== undefined ? " cur" : ""}`}
            data-block={block}
          >
            <span className="dn">{L?.a ?? ""}</span>
            <span
              className={`dl ${L ? (L.t === "same" ? "" : "del") : "none"}`}
            >
              {L && <Segs op={L} side="a" />}
            </span>
            <span className="dn">{R?.b ?? ""}</span>
            <span
              className={`dl ${R ? (R.t === "same" ? "" : "add") : "none"}`}
            >
              {R && <Segs op={R} side="b" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InlineView({
  ops,
  blocks,
  cur,
  open,
  onOpen,
}: {
  ops: Op[];
  blocks: number[];
  cur: number;
  open: Set<number>;
  onOpen: (n: number) => void;
}) {
  const blockAt = new Map(blocks.map((at, i) => [at, i]));
  const indexed = ops.map((op, i) => ({ op, i }));
  const items = fold(indexed, (x) => x.op.t === "same", open);
  return (
    <div className="diff-inline">
      {items.map((x) => {
        if (isFold(x))
          return (
            <FoldRow
              key={`f${x.fold}`}
              count={x.count}
              onOpen={() => onOpen(x.fold)}
            />
          );
        const { op, i } = x;
        const block = blockAt.get(i);
        return (
          <div
            key={i}
            className={`diff-row${block === cur && block !== undefined ? " cur" : ""}`}
            data-block={block}
          >
            <span className="dn">{op.a ?? ""}</span>
            <span className="dn">{op.b ?? ""}</span>
            <span className="dm" aria-hidden="true">
              {op.t === "add" ? "+" : op.t === "del" ? "−" : ""}
            </span>
            <span className={`dl ${op.t === "same" ? "" : op.t}`}>
              <Segs op={op} side={op.t === "del" ? "a" : "b"} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
