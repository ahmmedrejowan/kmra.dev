import { useEffect, useState } from "react";
import { formatKeys, isApple, SHORTCUTS, typing } from "../lib/keys";

/** "?" opens a list of keyboard shortcuts, written for the visitor's OS. */
export default function Shortcuts() {
  const [open, setOpen] = useState(false);
  const [apple, setApple] = useState(true);

  useEffect(() => {
    setApple(isApple());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !typing(e) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest?.("[data-shortcuts]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    window.addEventListener("kmra:shortcuts", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      window.removeEventListener("kmra:shortcuts", onEvent);
    };
  }, []);

  if (!open) return null;
  return (
    <div
      className="scrim"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="palette keys-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="keys-head">
          <strong>Keyboard shortcuts</strong>
          <span className="muted">{apple ? "macOS" : "Windows and Linux"}</span>
          <button
            type="button"
            className="btn sm"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        {SHORTCUTS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <ul>
              {g.items.map((it) => (
                <li key={it.label}>
                  <span>{it.label}</span>
                  <span className="keys">
                    {it.keys.map((k) => (
                      <kbd key={k}>{formatKeys(k, apple)}</kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
