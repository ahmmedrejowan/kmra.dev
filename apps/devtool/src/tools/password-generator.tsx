import { useEffect, useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarCheck, BarField, BarSeg, Pane, Workspace } from "../lib/kit";
import { Rows } from "../lib/rows";
import { pick, randomInt } from "../lib/random";
import { WORDS } from "../lib/words";

type Mode = "password" | "passphrase";

const SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~",
} as const;
type SetName = keyof typeof SETS;
/** Characters that are easy to mix up when read or typed */
const LOOKALIKE = new Set("Il1|O0o`'\";:,.");

const clamp = (raw: string, lo: number, hi: number, dflt: number) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && raw !== ""
    ? Math.min(hi, Math.max(lo, n))
    : dflt;
};

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function makePassword(
  length: number,
  sets: string[],
  guarantee: boolean,
): string {
  const pool = sets.join("");
  const out: string[] = [];
  if (guarantee) for (const s of sets) out.push(s[randomInt(s.length)]!);
  while (out.length < length) out.push(pool[randomInt(pool.length)]!);
  return shuffle(out).slice(0, length).join("");
}

function makePhrase(
  words: number,
  sep: string,
  cap: boolean,
  number: boolean,
): string {
  const list = Array.from({ length: words }, () => {
    const w = pick(WORDS);
    return cap ? w[0]!.toUpperCase() + w.slice(1) : w;
  });
  if (number) {
    const i = randomInt(list.length);
    list[i] = list[i] + String(randomInt(100));
  }
  return list.join(sep);
}

function strength(bits: number): [string, number] {
  if (bits < 28) return ["Very weak", 1];
  if (bits < 40) return ["Weak", 2];
  if (bits < 60) return ["Fair", 3];
  if (bits < 90) return ["Strong", 4];
  return ["Very strong", 5];
}

export default function PasswordGenerator({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>(
    preset?.mode === "passphrase" ? "passphrase" : "password",
  );
  const [lengthRaw, setLengthRaw] = useState("20");
  const [use, setUse] = useState<Record<SetName, boolean>>({
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
  });
  const [noLookalike, setNoLookalike] = useState(false);
  const [guarantee, setGuarantee] = useState(true);
  const [wordsRaw, setWordsRaw] = useState("5");
  const [sep, setSep] = useState("-");
  const [cap, setCap] = useState(false);
  const [number, setNumber] = useState(false);
  const [countRaw, setCountRaw] = useState("5");
  const [round, setRound] = useState(0);

  const length = clamp(lengthRaw, 4, 128, 20);
  const words = clamp(wordsRaw, 3, 20, 5);
  const count = clamp(countRaw, 1, 50, 5);

  const sets = (Object.keys(SETS) as SetName[])
    .filter((k) => use[k])
    .map((k) =>
      noLookalike
        ? [...SETS[k]].filter((c) => !LOOKALIKE.has(c)).join("")
        : SETS[k],
    );
  const poolSize = sets.join("").length;

  // Random output is made in the browser only (after hydration)
  useEffect(() => setRound(1), []);
  const list = useMemo(() => {
    if (!round) return [];
    if (mode === "password" && !poolSize) return [];
    return Array.from({ length: count }, () =>
      mode === "password"
        ? makePassword(length, sets, guarantee)
        : makePhrase(words, sep, cap, number),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    round,
    mode,
    count,
    length,
    sets.join("|"),
    guarantee,
    words,
    sep,
    cap,
    number,
  ]);

  const bits =
    mode === "password"
      ? poolSize
        ? length * Math.log2(poolSize)
        : 0
      : words * Math.log2(WORDS.length) +
        (number ? Math.log2(100) + Math.log2(words) : 0);
  const [label, level] = strength(bits);

  const toggle = (k: SetName) => (on: boolean) =>
    setUse((u) => ({ ...u, [k]: on }));

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Make")}
            options={[
              ["password", T("Password")],
              ["passphrase", T("Passphrase")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "password" ? (
            <>
              <BarField
                label={T("Length")}
                type="number"
                min={4}
                max={128}
                width={64}
                value={lengthRaw}
                onChange={setLengthRaw}
              />
              <BarCheck label="A–Z" on={use.upper} onChange={toggle("upper")} />
              <BarCheck label="a–z" on={use.lower} onChange={toggle("lower")} />
              <BarCheck
                label="0–9"
                on={use.digits}
                onChange={toggle("digits")}
              />
              <BarCheck
                label={T("Symbols")}
                on={use.symbols}
                onChange={toggle("symbols")}
              />
              <BarCheck
                label={T("Skip look-alikes")}
                on={noLookalike}
                onChange={setNoLookalike}
              />
              <BarCheck
                label={T("At least one of each")}
                on={guarantee}
                onChange={setGuarantee}
              />
            </>
          ) : (
            <>
              <BarField
                label={T("Words")}
                type="number"
                min={3}
                max={20}
                width={56}
                value={wordsRaw}
                onChange={setWordsRaw}
              />
              <BarField
                label={T("Separator")}
                width={44}
                value={sep}
                onChange={(v) => setSep(v.slice(0, 3))}
              />
              <BarCheck label={T("Capitalise")} on={cap} onChange={setCap} />
              <BarCheck
                label={T("Add a number")}
                on={number}
                onChange={setNumber}
              />
            </>
          )}
          <BarField
            label={T("How many")}
            type="number"
            min={1}
            max={50}
            width={56}
            value={countRaw}
            onChange={setCountRaw}
          />
          <button
            type="button"
            className="btn xs bar-push"
            onClick={() => setRound((r) => r + 1)}
          >
            <Icon name="shuffle" />
            {T("Make new ones")}
          </button>
        </>
      }
      status={
        <>
          <span>{T("Made with your browser's secure random generator.")}</span>
          <span>{T("They stay on your device until you copy them.")}</span>
        </>
      }
    >
      <Pane
        label={T(mode === "password" ? "Passwords" : "Passphrases")}
        value={list.join("\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows
            rows={list.map((v, i) => ({ id: String(i), value: v }))}
            numbered
            empty={
              round && !poolSize ? (
                <span className="bad">
                  {T("Pick at least one set of characters.")}
                </span>
              ) : null
            }
          />
        </div>
      </Pane>
      <Pane label={T("Strength")} value="">
        <div className="dev-list pw-strength">
          <div className={`pw-meter l${level}`} aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i <= level ? "on" : ""} />
            ))}
          </div>
          <p className="pw-label" data-level={level}>
            <strong>{T(label)}</strong>
            <span>{T("{n} bits of entropy", { n: Math.round(bits) })}</span>
          </p>
          <dl className="dev-facts">
            {mode === "password" ? (
              <>
                <dt>{T("Characters to pick from")}</dt>
                <dd>{poolSize}</dd>
                <dt>{T("Length")}</dt>
                <dd>{length}</dd>
              </>
            ) : (
              <>
                <dt>{T("Words in the list")}</dt>
                <dd>{WORDS.length.toLocaleString("en")}</dd>
                <dt>{T("Words")}</dt>
                <dd>{words}</dd>
              </>
            )}
            <dt>{T("Guesses to try them all")}</dt>
            <dd>
              2<sup>{Math.round(bits)}</sup>
            </dd>
          </dl>
          <p className="dev-note">
            {T(
              "Each extra character or word multiplies the guesses an attacker needs. 60 bits or more is strong for most accounts; use a password manager to keep them.",
            )}
          </p>
        </div>
      </Pane>
    </Workspace>
  );
}
