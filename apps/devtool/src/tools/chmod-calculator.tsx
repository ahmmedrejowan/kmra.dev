import { useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarCheck, BarField, Pane, Workspace, useInput } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import {
  ModeError,
  PRESETS,
  SETGID,
  SETUID,
  STICKY,
  WHO,
  bit,
  clauses,
  octal,
  parseMode,
  symbolic,
  type Who,
} from "../lib/chmod";

const WHO_NAME: Record<Who, string> = {
  u: "Owner",
  g: "Group",
  o: "Others",
};
const PERMS = [
  ["r", "Read"],
  ["w", "Write"],
  ["x", "Execute"],
] as const;
const SPECIALS: [number, string, string][] = [
  [SETUID, "Setuid", "Runs as the file's owner"],
  [SETGID, "Setgid", "Runs as the group; new files in a folder take its group"],
  [STICKY, "Sticky", "In a folder, only owners can delete their files"],
];

/** Quote a file name for the shell if it needs it */
function shellName(name: string): string {
  const n = name.trim() || "file";
  return /^[\w./@%+=:,-]+$/.test(n) ? n : `'${n.replace(/'/g, `'\\''`)}'`;
}

export default function ChmodCalculator({ preset }: ToolProps) {
  const T = useT();
  const [text, setText] = useInput(
    "chmod-calculator",
    typeof preset?.mode === "string" ? preset.mode : "755",
  );
  const [file, setFile] = useState("file");
  const [recursive, setRecursive] = useState(false);
  const good = useRef(0o755);

  let error: string | null = null;
  let form: "octal" | "symbolic" | "clauses" | null = null;
  try {
    const r = parseMode(text);
    good.current = r.mode;
    form = r.form;
  } catch (e) {
    if (!(e instanceof ModeError)) throw e;
    error = T(e.message, e.vars);
  }
  const mode = good.current;
  const set = (m: number) => setText(octal(m));
  const toggle = (b: number) => set(mode ^ b);

  const sym = symbolic(mode);
  const target = shellName(file);
  const r = recursive ? " -R" : "";
  const rows: Row[] = [
    { id: "octal", label: T("Octal"), value: octal(mode) },
    { id: "symbolic", label: T("Symbolic"), value: sym },
    { id: "ls", label: T("As ls shows it"), value: "-" + sym },
    {
      id: "cmd-octal",
      label: T("Command"),
      value: `chmod${r} ${octal(mode)} ${target}`,
    },
    {
      id: "cmd-symbolic",
      label: T("Command, symbolic"),
      value: `chmod${r} ${clauses(mode)} ${target}`,
    },
  ];

  const said = WHO.map((who) => {
    const can = PERMS.filter(([p]) => mode & bit(who, p)).map(([p]) =>
      T(p === "r" ? "read" : p === "w" ? "write" : "run"),
    );
    const name = T(WHO_NAME[who]);
    if (!can.length) return T("{who} can't do anything.", { who: name });
    const list =
      can.length === 1
        ? can[0]!
        : T("{a} and {b}", { a: can.slice(0, -1).join(", "), b: can.at(-1)! });
    return T("{who} can {what}.", { who: name, what: list });
  });
  const notes: string[] = [];
  if (mode & SETUID)
    notes.push(T("Setuid: a program runs with its owner's rights."));
  if (mode & SETGID)
    notes.push(
      T(
        "Setgid: a program runs with its group's rights, and new files in a folder get the folder's group.",
      ),
    );
  if (mode & STICKY)
    notes.push(
      T("Sticky: in a folder, only a file's owner can rename or delete it."),
    );
  if (/[ST]/.test(sym))
    notes.push(
      T(
        "A capital S or T means the special bit is set without execute, so it has no effect.",
      ),
    );
  if (mode & 0o002) notes.push(T("Anyone on the system can change this file."));

  return (
    <Workspace
      bar={
        <>
          <BarField
            label={T("File name")}
            value={file}
            width={150}
            onChange={setFile}
          />
          <BarCheck
            label={T("Include subfolders (-R)")}
            on={recursive}
            onChange={setRecursive}
          />
        </>
      }
      status={
        error ? (
          <span className="bad">{error}</span>
        ) : (
          <span className="ok">
            {form === "octal"
              ? T("Read as an octal number")
              : form === "symbolic"
                ? T("Read as symbolic permissions")
                : T("Read as chmod rules, starting from 000")}
          </span>
        )
      }
    >
      <Pane
        label={T("Permissions")}
        value={text}
        onChange={setText}
        error={error ? { message: error } : null}
      >
        <div className="dev-list">
          <div className="dev-form">
            <label className="dev-field">
              <span>{T("Mode: 755, rwxr-xr-x or u=rwx,g=rx,o=rx")}</span>
              <input
                className="dev-input mono"
                value={text}
                placeholder="755"
                aria-label={T("Mode")}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          </div>
          <table className="chmod-grid">
            <thead>
              <tr>
                <th />
                {PERMS.map(([p, l]) => (
                  <th key={p} scope="col">
                    {T(l)}
                  </th>
                ))}
                <th scope="col" className="chmod-digit">
                  {T("Digit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {WHO.map((who) => (
                <tr key={who}>
                  <th scope="row">{T(WHO_NAME[who])}</th>
                  {PERMS.map(([p, l]) => (
                    <td key={p}>
                      <input
                        type="checkbox"
                        aria-label={T("{who}: {perm}", {
                          who: T(WHO_NAME[who]),
                          perm: T(l),
                        })}
                        checked={!!(mode & bit(who, p))}
                        onChange={() => toggle(bit(who, p))}
                      />
                    </td>
                  ))}
                  <td className="chmod-digit">
                    <code>
                      {(mode >> (who === "u" ? 6 : who === "g" ? 3 : 0)) & 7}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="chmod-special">
            {SPECIALS.map(([b, l, hint]) => (
              <label key={l} title={T(hint)}>
                <input
                  type="checkbox"
                  checked={!!(mode & b)}
                  onChange={() => toggle(b)}
                />
                <span>
                  {T(l)}
                  <small>{T(hint)}</small>
                </span>
              </label>
            ))}
          </div>
          <h3 className="dev-sub">{T("Common modes")}</h3>
          <ul className="chmod-presets">
            {PRESETS.map(([m, what]) => (
              <li key={m}>
                <button
                  type="button"
                  aria-pressed={octal(mode) === m}
                  onClick={() => setText(m)}
                >
                  <code>{m}</code>
                  <span>{T(what)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Pane>
      <Pane
        label={T("Result")}
        value={rows.map((x) => x.value).join("\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows rows={rows} />
          <div className="chmod-said">
            {said.map((s) => (
              <p key={s}>{s}</p>
            ))}
            {notes.map((s) => (
              <p key={s} className="muted">
                {s}
              </p>
            ))}
          </div>
        </div>
      </Pane>
    </Workspace>
  );
}
