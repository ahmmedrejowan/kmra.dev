import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import { CopyBtn } from "@kmra/ui/components/kit";
import type { ToolProps } from ".";
import { BarCheck, BarSeg, Pane, Workspace } from "../lib/kit";
import { CLASSES, STATUSES, search, type Status } from "../lib/http-status";

function fromHash(): number | null {
  const m = /^#(\d{3})$/.exec(location.hash);
  return m && STATUSES.some((s) => s.code === Number(m[1]))
    ? Number(m[1])
    : null;
}

export default function HttpStatus({ preset }: ToolProps) {
  const T = useT();
  const lang = useLang();
  const [page, setPage] = useState("");
  const [q, setQ] = useState("");
  const [cls, setCls] = useState(
    typeof preset?.class === "number" ? preset.class : 0,
  );
  const [extra, setExtra] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const scroll = useRef<number | null>(null);

  // #404 opens that code; the hash also follows clicks so the link can be shared
  useEffect(() => {
    const go = () => {
      const c = fromHash();
      if (c === null) return;
      setQ("");
      setCls(0);
      setExtra(true);
      setPicked(c);
      scroll.current = c;
    };
    setPage(location.origin + location.pathname);
    go();
    addEventListener("hashchange", go);
    return () => removeEventListener("hashchange", go);
  }, []);

  const shown = useMemo(() => {
    const base = STATUSES.filter(
      (s) =>
        (cls === 0 || Math.floor(s.code / 100) === cls) && (extra || !s.src),
    );
    return search(base, q);
  }, [q, cls, extra]);

  const current: Status | undefined =
    shown.find((s) => s.code === picked) ?? shown[0];

  useEffect(() => {
    if (scroll.current === null || current?.code !== scroll.current) return;
    scroll.current = null;
    // Scroll only the list, not the page
    const box = list.current;
    const el = box?.querySelector(`[data-code="${current.code}"]`);
    if (box && el)
      box.scrollTop +=
        el.getBoundingClientRect().top -
        box.getBoundingClientRect().top -
        box.clientHeight / 2;
  }, [current]);

  function pick(code: number) {
    setPicked(code);
    history.replaceState(null, "", `#${code}`);
  }

  // Group by class unless searching (then best matches come first)
  const groups: [number, Status[]][] = q.trim()
    ? [[0, shown]]
    : CLASSES.map(([c]) => [
        c,
        shown.filter((s) => Math.floor(s.code / 100) === c),
      ]);
  const clsInfo = (code: number) =>
    CLASSES.find(([c]) => c === Math.floor(code / 100));

  return (
    <Workspace
      bar={
        <>
          <label className="bar-item">
            <span className="bar-label">{T("Search")}</span>
            <input
              className="bar-input"
              type="search"
              style={{ width: 200 }}
              value={q}
              placeholder={T("404 or not found")}
              aria-label={T("Search status codes")}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <BarSeg<number>
            label={T("Class")}
            options={[
              [0, T("All")],
              ...CLASSES.map(([c, l]) => [c, l] as [number, string]),
            ]}
            value={cls}
            onPick={setCls}
          />
          <BarCheck
            label={T("Show non-standard codes")}
            on={extra}
            onChange={setExtra}
          />
        </>
      }
      status={
        <span>
          {shown.length
            ? T("{n} codes", { n: shown.length })
            : T("No code matches.")}
        </span>
      }
    >
      <Pane label={T("Codes")} value="" readOnly>
        <div className="dev-list http-list" ref={list}>
          {shown.length === 0 && (
            <p className="dev-rows-empty">
              {T(
                "No code matches “{q}”. Try a number or a word like timeout.",
                {
                  q,
                },
              )}
            </p>
          )}
          {groups.map(([c, items]) =>
            items.length === 0 ? null : (
              <section key={c}>
                {c > 0 && (
                  <h3 className="dev-sub">{T(clsInfo(c * 100)![2])}</h3>
                )}
                <ul>
                  {items.map((s) => (
                    <li key={s.code}>
                      <button
                        type="button"
                        data-code={s.code}
                        aria-pressed={current?.code === s.code}
                        className={`http-item c${Math.floor(s.code / 100)}`}
                        onClick={() => pick(s.code)}
                      >
                        <code>{s.code}</code>
                        <span className="http-name">{s.name}</span>
                        {s.src && (
                          <span className="http-tag">{T("Non-standard")}</span>
                        )}
                        {s.old && (
                          <span className="http-tag">{T("Deprecated")}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      </Pane>
      <Pane
        label={T("Details")}
        value={current ? `${current.code} ${current.name}` : ""}
        readOnly
      >
        <div className="dev-list">
          {current ? (
            <article
              className={`http-detail c${Math.floor(current.code / 100)}`}
              data-detail={current.code}
            >
              <p className="http-big">
                <strong>{current.code}</strong>
                <span>{current.name}</span>
              </p>
              <p className="http-class">{T(clsInfo(current.code)![2])}</p>
              {(current.src || current.old) && (
                <p className="http-flags">
                  {current.src && (
                    <span className="http-tag">
                      {T("Non-standard: {src}", { src: current.src })}
                    </span>
                  )}
                  {current.old && (
                    <span className="http-tag">{T("Deprecated")}</span>
                  )}
                </p>
              )}
              <h3>{T("What it means")}</h3>
              <p>{current.desc}</p>
              <h3>
                {current.code >= 400 ? T("Common causes") : T("When to use it")}
              </h3>
              <p>{current.use}</p>
              <dl className="dev-facts">
                {current.spec && (
                  <>
                    <dt>{T("Defined in")}</dt>
                    <dd>{current.spec}</dd>
                  </>
                )}
                <dt>{T("Registered")}</dt>
                <dd>
                  {current.src
                    ? T("No, used by {src}", { src: current.src })
                    : T("Yes, in the IANA registry")}
                </dd>
              </dl>
              <div className="http-copy">
                <CopyBtn
                  text={String(current.code)}
                  label={T("Copy the code")}
                  className="btn xs"
                />
                <CopyBtn
                  text={`${current.code} ${current.name}`}
                  label={T("Copy the code and name")}
                  className="btn xs"
                />
                {page && (
                  <CopyBtn
                    text={`${page}#${current.code}`}
                    label={T("Copy a link")}
                    className="btn xs"
                  />
                )}
              </div>
            </article>
          ) : (
            <p className="dev-rows-empty">
              {T("Pick a code to read about it.")}
            </p>
          )}
          {current && (
            <p className="dev-note">
              {lang !== "en" && T("Explanations are in English.") + " "}
              {T(
                "Codes marked non-standard aren't in the IANA registry; they come from servers and services such as nginx and Cloudflare.",
              )}
            </p>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
