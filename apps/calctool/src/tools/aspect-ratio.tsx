import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Chips,
  Hero,
  How,
  NumField,
  Row,
  Stats,
  Waiting,
  useCheck,
  useFmt,
} from "../lib/ui";

/** Common ratios, with a typical size for each */
const COMMON: [string, number, number][] = [
  ["16:9", 16, 9],
  ["4:3", 4, 3],
  ["3:2", 3, 2],
  ["1:1", 1, 1],
  ["21:9", 21, 9],
  ["9:16", 9, 16],
  ["4:5", 4, 5],
  ["5:4", 5, 4],
];

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Simplest whole-number ratio for any two positive numbers (decimals are scaled up first) */
export function ratio(w: number, h: number): [number, number] {
  let k = 1;
  while (
    k < 1e6 &&
    (!Number.isInteger(Math.round(w * k * 1e9) / 1e9) ||
      !Number.isInteger(Math.round(h * k * 1e9) / 1e9))
  )
    k *= 10;
  const a = Math.round(w * k);
  const b = Math.round(h * k);
  const g = gcd(a, b) || 1;
  return [a / g, b / g];
}

export default function AspectRatio(_: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [w, setW] = useState("1920");
  const [h, setH] = useState("1080");
  // The new size: whichever side was typed last drives the other
  const [nw, setNw] = useState("1280");
  const [nh, setNh] = useState("");
  const [drive, setDrive] = useState<"w" | "h">("w");

  const [W, ew] = check(w, { positive: true });
  const [H, eh] = check(h, { positive: true });
  const [NW, enw] = check(nw, { positive: true });
  const [NH, enh] = check(nh, { positive: true });

  const ok = W !== null && H !== null;
  const r = ok ? ratio(W, H) : null;
  const named = ok
    ? COMMON.find(([, a, b]) => Math.abs(a / b - W / H) / (W / H) < 0.01)
    : undefined;
  const newH = ok && drive === "w" && NW !== null ? (NW * H) / W : null;
  const newW = ok && drive === "h" && NH !== null ? (NH * W) / H : null;

  const result = !r ? (
    <Waiting>{T("Type a width and a height.")}</Waiting>
  ) : (
    <>
      <Hero
        label={T("Aspect ratio")}
        value={`${f.d(r[0])}:${f.d(r[1])}`}
        raw={`${r[0]}:${r[1]}`}
        sub={
          named && named[0] !== `${r[0]}:${r[1]}`
            ? T("Close to {r}", { r: f.d(named[0]) })
            : undefined
        }
      />
      <div className="calc-ratio-box" aria-hidden="true">
        <div
          style={{
            aspectRatio: `${W} / ${H}`,
            [W! >= H! ? "width" : "height"]:
              W! >= H! ? "min(100%, 240px)" : "100%",
          }}
        >
          {f.d(r[0])}:{f.d(r[1])}
        </div>
      </div>
      <Stats
        rows={[
          {
            id: "decimal",
            label: T("As a decimal"),
            value: `${f.n(W! / H!, 4)}:${f.d(1)}`,
            raw: W! / H!,
          },
          ...(newH !== null
            ? [
                {
                  id: "new",
                  label: T("New height"),
                  value: f.n(newH, 2),
                  raw: newH,
                  on: true,
                },
              ]
            : []),
          ...(newW !== null
            ? [
                {
                  id: "new",
                  label: T("New width"),
                  value: f.n(newW, 2),
                  raw: newW,
                  on: true,
                },
              ]
            : []),
        ]}
      />
    </>
  );

  return (
    <CalcCard
      result={result}
      below={
        r && (
          <How>
            <p>
              {T("Both sides divided by their greatest common divisor:")}{" "}
              {f.n(W!, 4)} × {f.n(H!, 4)} →{" "}
              <b>
                {f.d(r[0])}:{f.d(r[1])}
              </b>
            </p>
            {newH !== null && (
              <p>
                {T("New height")} = {f.n(NW!, 4)} × {f.n(H!, 4)} ÷ {f.n(W!, 4)}{" "}
                = <b>{f.n(newH, 2)}</b>
              </p>
            )}
            {newW !== null && (
              <p>
                {T("New width")} = {f.n(NH!, 4)} × {f.n(W!, 4)} ÷ {f.n(H!, 4)} ={" "}
                <b>{f.n(newW, 2)}</b>
              </p>
            )}
          </How>
        )
      }
    >
      <Row>
        <NumField
          name="w"
          label={T("Width")}
          value={w}
          error={ew}
          onChange={setW}
        />
        <NumField
          name="h"
          label={T("Height")}
          value={h}
          error={eh}
          onChange={setH}
        />
      </Row>
      <Chips
        label={T("Common ratios")}
        value={named?.[0]}
        onPick={(name) => {
          const c = COMMON.find((x) => x[0] === name)!;
          // Keep the width, fit the height to the ratio
          const base = W ?? 1920;
          setW(String(base));
          setH(String(Number(((base * c[2]) / c[1]).toFixed(2))));
        }}
        options={COMMON.map(([n]) => [n, f.d(n)] as [string, string])}
      />
      <div className="calc-field">
        <span className="calc-label">{T("Resize, keeping the ratio")}</span>
        <Row>
          <NumField
            name="nw"
            label={T("New width")}
            value={
              drive === "w"
                ? nw
                : newW !== null
                  ? String(Number(newW.toFixed(2)))
                  : ""
            }
            error={drive === "w" ? enw : null}
            onChange={(v) => {
              setNw(v);
              setDrive("w");
            }}
          />
          <NumField
            name="nh"
            label={T("New height")}
            value={
              drive === "h"
                ? nh
                : newH !== null
                  ? String(Number(newH.toFixed(2)))
                  : ""
            }
            error={drive === "h" ? enh : null}
            onChange={(v) => {
              setNh(v);
              setDrive("h");
            }}
          />
        </Row>
      </div>
    </CalcCard>
  );
}
