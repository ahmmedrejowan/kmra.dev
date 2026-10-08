import { useEffect, useMemo, useRef, useState } from "react";
import type { IconKey } from "../lib/icons";
import { matches, typing } from "../lib/keys";
import { Icon } from "./Icon";
import { t, type Locale } from "../lib/i18n";

export interface PaletteItem {
  group: string;
  name: string;
  hint: string;
  href: string;
  icon: IconKey;
}

/** ⌘K / Ctrl+K search across every tool and task on every kmra app. */
export default function CommandPalette({
  items,
  lang = "en",
}: {
  items: PaletteItem[];
  lang?: Locale;
}) {
  const T = (s: string) => t(lang, s);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if (
        matches(e, "mod+k") ||
        (e.key === "/" && !typing(e) && !e.metaKey && !e.ctrlKey)
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("kmra:palette", toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("kmra:palette", toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q
      ? items.filter((i) =>
          `${i.name} ${i.hint} ${i.group}`.toLowerCase().includes(q),
        )
      : items;
  }, [items, query]);

  if (!open) return null;

  const go = (item?: PaletteItem) => {
    if (!item) return;
    if (item.href === "#shortcuts") {
      setOpen(false);
      window.dispatchEvent(new CustomEvent("kmra:shortcuts"));
      return;
    }
    window.location.href = item.href;
  };

  let lastGroup = "";
  return (
    <div
      className="scrim"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={T("Search tools")}
      >
        <div className="in">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            placeholder={T("Search tools and tasks…")}
            aria-label={T("Search tools and tasks")}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => (s + 1) % Math.max(results.length, 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel(
                  (s) => (s - 1 + results.length) % Math.max(results.length, 1),
                );
              } else if (e.key === "Enter") go(results[sel]);
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox">
          {results.length === 0 && (
            <li className="grp">
              {T('No matches. Try "compress", "webp" or "instagram".')}
            </li>
          )}
          {results.map((item, i) => {
            const head = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.href} role="presentation">
                {head && <div className="grp">{head}</div>}
                <div
                  role="option"
                  aria-selected={i === sel}
                  className="opt"
                  onMouseMove={() => setSel(i)}
                  onClick={() => go(item)}
                >
                  <Icon name={item.icon} />
                  {item.name}
                  <small>{item.hint}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
