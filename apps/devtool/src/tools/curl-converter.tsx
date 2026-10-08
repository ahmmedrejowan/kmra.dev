import { useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarSeg, Pane, Workspace, useInput, type PaneError } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import { lineCol } from "../lib/encode";
import { CurlError, LANGS, parseCurl, type Lang } from "../lib/curl";

const SAMPLE = `curl -X POST 'https://api.example.com/v1/users?team=core' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{"name": "Ada Lovelace", "admin": true}'`;

export default function CurlConverter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("curl-converter");
  const [lang, setLang] = useState<Lang>(
    (Object.keys(LANGS) as Lang[]).find((l) => l === preset?.lang) ?? "fetch",
  );

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, req: parseCurl(input) };
    } catch (e) {
      if (!(e instanceof CurlError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input]);

  const error: PaneError | null =
    result && !result.ok
      ? {
          message:
            T(result.error.message) +
            (result.error.detail ? ` ${result.error.detail}` : ""),
          ...(result.error.index !== undefined
            ? lineCol(input, result.error.index)
            : {}),
        }
      : null;

  const req = result?.ok ? result.req : null;
  const code = req ? LANGS[lang].gen(req) : "";

  const rows: Row[] = [];
  if (req) {
    rows.push(
      { id: "method", label: T("Method"), value: req.method },
      { id: "url", label: "URL", value: req.url },
    );
    let query: URLSearchParams | null = null;
    try {
      query = new URL(req.url).searchParams;
    } catch {}
    if (query)
      [...query].forEach(([k, v], i) =>
        rows.push({ id: `q${i}`, label: T("Query: {k}", { k }), value: v }),
      );
    req.headers.forEach(([k, v], i) =>
      rows.push({ id: `h${i}`, label: k, value: v }),
    );
    if (req.auth)
      rows.push({
        id: "auth",
        label: T("Basic auth"),
        value: `${req.auth[0]}:${req.auth[1]}`,
      });
    if (req.form)
      req.form.forEach((f, i) =>
        rows.push({
          id: `f${i}`,
          label: T("Form: {k}", { k: f.name }),
          value: f.file ? `@${f.file}` : f.value,
          note: f.file ? T("file") : undefined,
        }),
      );
    else if (req.body !== null)
      rows.push({
        id: "body",
        label: T("Body"),
        value:
          req.json !== undefined ? JSON.stringify(req.json, null, 2) : req.body,
        note: req.json !== undefined ? "JSON" : undefined,
      });
    const flags = [
      req.follow && T("Follows redirects"),
      req.insecure && T("Skips certificate checks"),
      req.compressed && T("Accepts compressed responses"),
    ].filter(Boolean) as string[];
    if (flags.length)
      rows.push({
        id: "flags",
        label: T("Options"),
        value: flags.join(", "),
        noCopy: true,
      });
    req.notes.forEach(([m, x], i) =>
      rows.push({
        id: `n${i}`,
        label: T("Note"),
        value: `${T(m)} ${x}`,
        noCopy: true,
      }),
    );
  }

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Lang>
            label={T("Language")}
            options={(Object.keys(LANGS) as Lang[]).map((l) => [
              l,
              LANGS[l].label,
            ])}
            value={lang}
            onPick={setLang}
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
        !result ? (
          <span>
            {T(
              "Paste a cURL command, for example from your browser's Copy as cURL.",
            )}
          </span>
        ) : req ? (
          <>
            <span className="ok">
              {T("{m} request to {host}", {
                m: req.method,
                host: (() => {
                  try {
                    return new URL(req.url).host;
                  } catch {
                    return req.url;
                  }
                })(),
              })}
            </span>
            <span>{T("{n} headers", { n: req.headers.length })}</span>
          </>
        ) : (
          <span className="bad">{T("Couldn't read this command")}</span>
        )
      }
    >
      <Pane
        label={T("cURL command")}
        value={input}
        onChange={setInput}
        error={error}
      >
        <div className="dev-list">
          <div className="dev-form">
            <textarea
              className="dev-input mono curl-in"
              value={input}
              rows={9}
              placeholder="curl https://api.example.com -H 'Accept: application/json'"
              aria-label={T("cURL command")}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <h3 className="dev-sub">{T("What the command does")}</h3>
          <Rows
            rows={rows}
            empty={T("The method, URL, headers and body appear here.")}
          />
        </div>
      </Pane>
      <Pane
        label={LANGS[lang].label}
        value={code}
        readOnly
        download={LANGS[lang].file}
      />
    </Workspace>
  );
}
