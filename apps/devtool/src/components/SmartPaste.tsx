import { useMemo, useState } from "react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { detect } from "../lib/detect";
import { giveText } from "../lib/handoff";

/**
 * Home page box: paste anything, see what it looks like, open the matching tool with the text
 * already in it.
 */
function SmartPasteView({ names }: { names: Record<string, string> }) {
  const T = useT();
  const L = useLp();
  const [text, setText] = useState("");
  // Only tools that are live (the page passes ready tools only)
  const guess = useMemo(() => {
    const g = detect(text);
    return g && names[g.slug] ? g : null;
  }, [text, names]);

  function open() {
    if (!guess) return;
    giveText(guess.slug, text);
    location.href = L(`/${guess.slug}`);
  }

  return (
    <div className="smart-paste">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) open();
        }}
        placeholder={T(
          "Paste JSON, a JWT, a timestamp, Base64, a cURL command, a color…",
        )}
        aria-label={T("Paste anything")}
        spellCheck={false}
        rows={5}
      />
      <div className="smart-foot">
        <span className="muted">
          {text.trim()
            ? guess
              ? T("Looks like {what}.", { what: T(guess.label) })
              : T("Not sure what this is. Pick a tool below.")
            : T("Everything stays in your browser.")}
        </span>
        <button
          type="button"
          className="btn acc"
          disabled={!guess}
          onClick={open}
        >
          {guess
            ? T("Open {tool}", { tool: names[guess.slug] ?? guess.slug })
            : T("Open the right tool")}
          <Icon name="right" />
        </button>
      </div>
    </div>
  );
}

export default function SmartPaste({
  lang,
  names,
}: {
  lang?: Locale;
  /** Names of the ready tools by slug, in the page's language */
  names: Record<string, string>;
}) {
  return (
    <LangProvider lang={lang}>
      <SmartPasteView names={names} />
    </LangProvider>
  );
}
