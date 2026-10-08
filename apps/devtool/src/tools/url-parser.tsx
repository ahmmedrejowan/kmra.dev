import { useState, type ReactNode } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn } from "@kmra/ui/components/kit";
import type { ToolProps } from ".";
import { BarCheck, Pane, Workspace, useInput } from "../lib/kit";
import {
  DEFAULT_PORTS,
  decodeLoose,
  decodeQuery,
  encodeQuery,
  hostToUnicode,
  readQuery,
  writeQuery,
  type Param,
} from "../lib/url";

const SAMPLE =
  "https://shop.example.com:8080/products/running%20shoes/trail?color=blue&size=42&color=red&q=light+and+fast#reviews";

/** Parse what was typed; a bare host like example.com/path is read as https:// */
function read(text: string): { url: URL; assumed: boolean } | null {
  const t = text.trim();
  if (!t) return null;
  try {
    return { url: new URL(t), assumed: false };
  } catch {}
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t) && /^[^\s/?#]+\.[^\s/?#]+/.test(t)) {
    try {
      return { url: new URL("https://" + t), assumed: true };
    } catch {}
  }
  return null;
}

function Part({
  id,
  label,
  value,
  onChange,
  placeholder,
  note,
  type = "text",
  extra,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  note?: ReactNode;
  type?: "text" | "password";
  extra?: ReactNode;
}) {
  return (
    <div className="url-part" data-part={id}>
      <label className="url-part-label" htmlFor={`url-${id}`}>
        {label}
      </label>
      <div className="url-part-main">
        <input
          id={`url-${id}`}
          className="dev-input mono"
          type={type}
          value={value}
          readOnly={!onChange}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onChange={(e) => onChange?.(e.target.value)}
        />
        {note && <p className="url-part-note">{note}</p>}
      </div>
      <span className="url-part-acts">
        {extra}
        {value && <CopyBtn text={value} className="btn xs" />}
      </span>
    </div>
  );
}

export default function UrlParser(_: ToolProps) {
  const T = useT();
  const [text, setText] = useInput("url-parser");
  const [decode, setDecode] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const parsed = read(text);
  const url = parsed?.url ?? null;
  const params = url ? readQuery(url.search) : [];

  /** Change one part of the URL and write the whole URL back */
  function edit(fn: (u: URL) => void) {
    if (!url) return;
    const u = new URL(url.href);
    try {
      fn(u);
    } catch {
      return;
    }
    setText(u.href);
  }
  function setParams(next: Param[]) {
    edit((u) => {
      u.search = writeQuery(next);
    });
  }
  function setParam(i: number, field: "key" | "value", typed: string) {
    const next = params.map((p) => ({ ...p }));
    const raw = decode ? encodeQuery(typed) : typed;
    next[i]![field] = raw;
    if (field === "value") next[i]!.eq = true;
    setParams(next);
  }

  const show = (raw: string) => (decode ? decodeQuery(raw) : raw);
  const unicodeHost = url ? hostToUnicode(url.hostname) : "";
  const idn = !!url && unicodeHost !== url.hostname;
  const hasCreds = !!url && (url.username !== "" || url.password !== "");
  const segments = url
    ? url.pathname
        .split("/")
        .slice(1)
        .filter((s, i, all) => s !== "" || i < all.length - 1)
    : [];
  const defPort = url ? DEFAULT_PORTS[url.protocol] : undefined;

  return (
    <Workspace
      bar={
        <>
          <BarCheck
            label={T("Decode %XX and +")}
            on={decode}
            onChange={setDecode}
          />
          {!text && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setText(SAMPLE)}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !text.trim() ? (
          <span>{T("Paste a URL to see its parts.")}</span>
        ) : url ? (
          <>
            <span className="ok">
              {parsed?.assumed
                ? T("Read as https://, since no scheme was given")
                : T("Valid URL")}
            </span>
            <span>{T("{n} query parameters", { n: params.length })}</span>
            {hasCreds && (
              <span className="bad">{T("Has a username or password")}</span>
            )}
          </>
        ) : (
          <span className="bad">
            {T("This isn't a full URL. It needs a scheme like https://.")}
          </span>
        )
      }
    >
      <Pane
        label={T("URL")}
        value={text}
        onChange={setText}
        wrap
        placeholder="https://example.com/path?key=value#section"
        error={
          text.trim() && !url
            ? {
                message: T(
                  "This isn't a full URL. It needs a scheme like https://.",
                ),
              }
            : null
        }
        actions={text && <CopyBtn text={text} className="btn xs" />}
      />
      <Pane label={T("Parts")} value={url?.href ?? ""} readOnly>
        <div className="dev-list">
          {!url ? (
            <p className="dev-rows-empty">
              {T(
                "The protocol, host, path, query and hash appear here, ready to edit.",
              )}
            </p>
          ) : (
            <>
              {hasCreds && (
                <p className="url-warn" role="note">
                  <Icon name="lock" />
                  {T(
                    "This URL has a username or password in it. Anyone who sees the URL, in logs, history or a shared link, can read them.",
                  )}
                </p>
              )}
              <div className="url-parts">
                <Part
                  id="protocol"
                  label={T("Protocol")}
                  value={url.protocol}
                  onChange={(v) =>
                    edit((u) => {
                      u.protocol = v;
                    })
                  }
                />
                {hasCreds && (
                  <>
                    <Part
                      id="username"
                      label={T("Username")}
                      value={decode ? decodeLoose(url.username) : url.username}
                      onChange={(v) =>
                        edit((u) => {
                          u.username = v;
                        })
                      }
                    />
                    <Part
                      id="password"
                      label={T("Password")}
                      type={showPass ? "text" : "password"}
                      value={decode ? decodeLoose(url.password) : url.password}
                      onChange={(v) =>
                        edit((u) => {
                          u.password = v;
                        })
                      }
                      extra={
                        <button
                          type="button"
                          className="btn xs"
                          aria-pressed={showPass}
                          onClick={() => setShowPass(!showPass)}
                        >
                          {showPass ? T("Hide") : T("Show")}
                        </button>
                      }
                    />
                  </>
                )}
                <Part
                  id="hostname"
                  label={T("Host")}
                  value={url.hostname}
                  onChange={(v) =>
                    edit((u) => {
                      u.hostname = v;
                    })
                  }
                  note={
                    idn ? (
                      <>
                        {T("International name:")}{" "}
                        <strong data-part="hostname-unicode">
                          {unicodeHost}
                        </strong>
                      </>
                    ) : undefined
                  }
                />
                <Part
                  id="port"
                  label={T("Port")}
                  value={url.port}
                  placeholder={defPort}
                  onChange={(v) =>
                    edit((u) => {
                      u.port = v;
                    })
                  }
                  note={
                    !url.port && defPort
                      ? T(
                          "Not set, so the default for {scheme} is used: {port}",
                          {
                            scheme: url.protocol.replace(":", ""),
                            port: defPort,
                          },
                        )
                      : undefined
                  }
                />
                <Part
                  id="origin"
                  label={T("Origin")}
                  value={url.origin === "null" ? "" : url.origin}
                />
                <Part
                  id="pathname"
                  label={T("Path")}
                  value={url.pathname}
                  onChange={(v) =>
                    edit((u) => {
                      u.pathname = v;
                    })
                  }
                  note={
                    segments.length > 0 ? (
                      <span className="url-segs">
                        {segments.map((s, i) => (
                          <code key={i}>
                            {decode ? decodeLoose(s) : s || " "}
                          </code>
                        ))}
                      </span>
                    ) : undefined
                  }
                />
                <Part
                  id="hash"
                  label={T("Hash")}
                  value={decode ? decodeLoose(url.hash) : url.hash}
                  placeholder="#"
                  onChange={(v) =>
                    edit((u) => {
                      u.hash = v;
                    })
                  }
                />
              </div>
              <h3 className="dev-sub url-q-head">
                <span>{T("Query parameters")}</span>
                {url.search && <CopyBtn text={url.search} className="btn xs" />}
              </h3>
              <table className="url-query">
                {params.length > 0 && (
                  <thead>
                    <tr>
                      <th>{T("Key")}</th>
                      <th>{T("Value")}</th>
                      <th>
                        <span className="sr-only">{T("Actions")}</span>
                      </th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {params.map((p, i) => (
                    <tr key={i} className="url-q-row">
                      <td>
                        <input
                          className="dev-input mono"
                          value={show(p.key)}
                          aria-label={T("Key {n}", { n: i + 1 })}
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(e) => setParam(i, "key", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="dev-input mono"
                          value={show(p.value)}
                          aria-label={T("Value {n}", { n: i + 1 })}
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(e) => setParam(i, "value", e.target.value)}
                        />
                      </td>
                      <td className="url-q-acts">
                        <CopyBtn text={show(p.value)} className="btn xs" />
                        <button
                          type="button"
                          className="btn xs"
                          aria-label={T("Remove parameter {n}", { n: i + 1 })}
                          title={T("Remove")}
                          onClick={() =>
                            setParams(params.filter((_, j) => j !== i))
                          }
                        >
                          <Icon name="x" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="url-q-foot">
                <button
                  type="button"
                  className="btn xs"
                  onClick={() =>
                    setParams([...params, { key: "key", value: "", eq: true }])
                  }
                >
                  <Icon name="plus" />
                  {T("Add a parameter")}
                </button>
                {params.length === 0 && (
                  <span className="muted">{T("No query string.")}</span>
                )}
              </div>
            </>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
