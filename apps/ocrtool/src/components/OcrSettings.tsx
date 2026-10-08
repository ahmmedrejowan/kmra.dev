import { useEffect, useMemo, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { EngineId } from "../lib/ocr/types";
import {
  browserLanguage,
  getLanguage,
  isLanguage,
  LANGUAGES,
  PHOTO_READY,
} from "../lib/ocr/languages";

/**
 * OCR settings shared by the image tools (Image to text, Batch OCR): languages (remembered on this
 * device, recently used first), engine and the options-bar controls. The PDF tools keep the same
 * `kmra-ocr-langs` key, so a language picked in one tool is the default in the others.
 */

export type EngineChoice = "auto" | EngineId;

const LANGS_KEY = "kmra-ocr-langs";
const RECENT_KEY = "kmra-ocr-recent";
/** More languages at once make Tesseract slower and less sure of each */
export const MAX_LANGS = 3;
/** Scripts that often appear with English words in them */
const WITH_ENGLISH = new Set(["chi_sim", "chi_tra", "jpn", "jpn_vert", "kor"]);

function readList(key: string): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!Array.isArray(v)) return null;
    const ok = v.filter(
      (x): x is string => typeof x === "string" && isLanguage(x),
    );
    return ok.length ? ok : null;
  } catch {
    return null;
  }
}
function writeList(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: just not remembered */
  }
}

/** Languages the reader probably wants: the page's or the browser's language, plus English */
function guessLangs(locale: string): string[] {
  const first =
    locale === "bn"
      ? "ben"
      : typeof navigator !== "undefined"
        ? browserLanguage(navigator.language)
        : undefined;
  return first && first !== "eng" ? [first, "eng"] : ["eng"];
}

function presetLangs(preset?: Preset): string[] | null {
  const l = preset?.lang;
  if (typeof l !== "string" || !isLanguage(l)) return null;
  return WITH_ENGLISH.has(l) ? [l, "eng"] : [l];
}

export function useOcrSettings(preset?: Preset) {
  const locale = useLang();
  const fromPreset = presetLangs(preset);
  const [langs, setLangsState] = useState<string[]>(fromPreset ?? ["eng"]);
  const [recent, setRecent] = useState<string[]>([]);
  const [engine, setEngine] = useState<EngineChoice>(
    preset?.engine === "document" || (preset?.engine === "photo" && PHOTO_READY)
      ? preset.engine
      : "auto",
  );
  // Stored values only after hydration (the server render can't know them)
  useEffect(() => {
    setRecent(readList(RECENT_KEY) ?? []);
    if (fromPreset) return;
    setLangsState(readList(LANGS_KEY) ?? guessLangs(locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setLangs = (v: string[]) => {
    const next = v.slice(0, MAX_LANGS);
    setLangsState(next);
    writeList(LANGS_KEY, next);
    const r = [...next, ...recent.filter((c) => !next.includes(c))].slice(0, 8);
    setRecent(r);
    writeList(RECENT_KEY, r);
  };
  return { langs, setLangs, recent, engine, setEngine };
}

export type OcrSettings = ReturnType<typeof useOcrSettings>;

/** "English" or "Chinese (Simplified)" in the interface language */
export function useLangName() {
  const T = useT();
  return (code: string) => {
    const l = getLanguage(code);
    return l ? T(l.name) : code;
  };
}

/** Engine choice for the options bar; hidden while only the document engine exists */
export function EngineBar({
  value,
  onPick,
  auto,
}: {
  value: EngineChoice;
  onPick: (v: EngineChoice) => void;
  /** What Auto picked for the current file, shown as "Auto (Document)" */
  auto?: EngineId | null;
}) {
  const T = useT();
  if (!PHOTO_READY) return null;
  const name = (e: EngineId) => (e === "photo" ? T("Photo") : T("Document"));
  const opts: [EngineChoice, string][] = [
    ["auto", auto ? T("Auto ({engine})", { engine: name(auto) }) : T("Auto")],
    ["document", T("Document")],
    ["photo", T("Photo and screenshot")],
  ];
  return (
    <div className="bar-item">
      <span className="bar-label">{T("Engine")}</span>
      <div className="seg sm" role="group" aria-label={T("Engine")}>
        {opts.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onPick(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Language picker: a button with the chosen languages that opens a searchable list (chosen and
 * recently used first). Shows each language's download size, or that it's already on this device.
 */
export function LangPicker({
  value,
  onChange,
  recent,
  cached,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  recent: string[];
  /** Languages already downloaded */
  cached: Set<string>;
}) {
  const T = useT();
  const name = useLangName();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = LANGUAGES.filter(
      (l) =>
        !s ||
        l.name.toLowerCase().includes(s) ||
        T(l.name).toLowerCase().includes(s) ||
        l.native.toLowerCase().includes(s) ||
        l.code.startsWith(s),
    );
    if (s) return match;
    const rank = (c: string) =>
      value.includes(c) ? 0 : recent.includes(c) ? 1 : 2;
    return [...match].sort((a, b) => rank(a.code) - rank(b.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, value, recent]);

  const toggle = (code: string) => {
    if (value.includes(code)) {
      if (value.length === 1) return;
      onChange(value.filter((c) => c !== code));
    } else if (value.length >= MAX_LANGS) {
      toast(
        T("Up to {n} languages at once. Remove one first.", { n: MAX_LANGS }),
      );
    } else onChange([...value, code]);
  };

  const label = value.map(name).join(", ");
  return (
    <div className="bar-item oi-langs" ref={box}>
      <span className="bar-label" id="oi-lang-label">
        {T("Languages")}
      </span>
      <button
        type="button"
        className="btn xs oi-lang-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="oi-lang-label oi-lang-value"
        onClick={() => setOpen(!open)}
      >
        <Icon name="languages" />
        <span id="oi-lang-value">{label}</span>
        <Icon name="down" />
      </button>
      {open && (
        <div className="oi-pop" role="dialog" aria-label={T("Languages")}>
          <input
            ref={input}
            className="bar-input oi-search"
            type="search"
            value={q}
            placeholder={T("Search languages")}
            aria-label={T("Search languages")}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && list[0]) {
                e.preventDefault();
                toggle(list[0].code);
                setQ("");
              }
            }}
          />
          <p className="oi-pop-hint">
            {T(
              "Pick up to {n}. Each language downloads once, then works offline.",
              {
                n: MAX_LANGS,
              },
            )}
          </p>
          <ul
            className="oi-pop-list"
            role="listbox"
            aria-multiselectable="true"
          >
            {list.map((l) => {
              const on = value.includes(l.code);
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={on ? "on" : ""}
                    onClick={() => toggle(l.code)}
                  >
                    <span className="oi-check" aria-hidden="true">
                      {on && <Icon name="check" />}
                    </span>
                    <span className="oi-lname">
                      {T(l.name)}
                      {l.native !== l.name && (
                        <span
                          className="oi-native"
                          dir={l.rtl ? "rtl" : undefined}
                        >
                          {l.native}
                        </span>
                      )}
                    </span>
                    <span className="oi-size">
                      {cached.has(l.code)
                        ? T("On this device")
                        : formatBytes(l.bytes)}
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && (
              <li className="oi-none">{T("No language matches.")}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Status line text for a running job: what is downloading or happening, in the reader's language */
export function useStageText() {
  const T = useT();
  const name = useLangName();
  return (status: string, p: number, missing: string[]) => {
    const pct = `${Math.round(p * 100)}%`;
    if (status === "Downloading language data" && missing.length) {
      const bytes = missing.reduce(
        (s, c) => s + (getLanguage(c)?.bytes ?? 0),
        0,
      );
      return missing.length === 1
        ? T(
            "Downloading the {name} language data, {size}. Only the first time. {pct}",
            {
              name: name(missing[0]!),
              size: formatBytes(bytes),
              pct,
            },
          )
        : T(
            "Downloading language data for {names}, {size}. Only the first time. {pct}",
            {
              names: missing.map(name).join(", "),
              size: formatBytes(bytes),
              pct,
            },
          );
    }
    if (status === "Loading engine") return T("Starting the OCR engine…");
    if (status === "Loading language data")
      return T("Preparing the language data…");
    if (status === "Reading text") return T("Reading text… {pct}", { pct });
    return `${T(status)} ${pct}`;
  };
}
