/**
 * Unix file permissions: a 12-bit mode (setuid, setgid, sticky, then rwx for owner, group and
 * others) to and from octal (755, 4755), symbolic strings (rwxr-xr-x, -rw-r--r--, with s/S/t/T)
 * and chmod clauses (u=rwx,g=rx,o=r, a+x, go-w).
 */

export const SETUID = 0o4000;
export const SETGID = 0o2000;
export const STICKY = 0o1000;

export type Who = "u" | "g" | "o";
export const WHO: Who[] = ["u", "g", "o"];
/** Bit for read/write/execute of one class */
export function bit(who: Who, p: "r" | "w" | "x"): number {
  const shift = who === "u" ? 6 : who === "g" ? 3 : 0;
  return (p === "r" ? 4 : p === "w" ? 2 : 1) << shift;
}

export class ModeError extends Error {
  constructor(
    message: string,
    public vars: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** 755 → "755", 4755 → "4755" */
export function octal(mode: number): string {
  const s = (mode & 0o7777).toString(8).padStart(3, "0");
  return mode & 0o7000 ? s.padStart(4, "0") : s.slice(-3);
}

/** rwxr-xr-x, with s/S for setuid/setgid and t/T for sticky */
export function symbolic(mode: number): string {
  let out = "";
  for (const who of WHO) {
    out += mode & bit(who, "r") ? "r" : "-";
    out += mode & bit(who, "w") ? "w" : "-";
    const x = mode & bit(who, "x");
    const special =
      who === "u" ? mode & SETUID : who === "g" ? mode & SETGID : mode & STICKY;
    const ch = who === "o" ? "t" : "s";
    out += special ? (x ? ch : ch.toUpperCase()) : x ? "x" : "-";
  }
  return out;
}

/** chmod clauses that set the mode exactly: u=rwx,g=rx,o=rx (u=rwxs, o=rwxt for the special bits) */
export function clauses(mode: number): string {
  return WHO.map((who) => {
    let p = "";
    if (mode & bit(who, "r")) p += "r";
    if (mode & bit(who, "w")) p += "w";
    if (mode & bit(who, "x")) p += "x";
    if (who === "u" && mode & SETUID) p += "s";
    if (who === "g" && mode & SETGID) p += "s";
    if (who === "o" && mode & STICKY) p += "t";
    return `${who}=${p}`;
  }).join(",");
}

/**
 * Read a mode typed in any of the usual forms. Clauses with + or - start from 000, since there's
 * no file whose mode they could change.
 */
export function parseMode(raw: string): {
  mode: number;
  form: "octal" | "symbolic" | "clauses";
} {
  const t = raw.trim();
  if (!t)
    throw new ModeError("Type a mode like 755, rwxr-xr-x or u=rwx,g=rx,o=rx.");

  // Octal: 755, 0755, 4755, 0o755
  const oct = /^(?:0o)?([0-7]{1,4})$/i.exec(t);
  if (oct) {
    const digits = oct[1]!;
    if (digits.length < 3)
      throw new ModeError(
        "An octal mode has three or four digits, like 644 or 0755.",
      );
    return { mode: parseInt(digits, 8), form: "octal" };
  }
  if (/^\d+$/.test(t))
    throw new ModeError(
      "Octal digits go from 0 to 7, so {value} isn't a mode.",
      { value: t },
    );

  // Symbolic: rwxr-xr-x or -rwxr-xr-x (an ls listing; a trailing . or + marks ACLs)
  const sym =
    /^([-dlbcps])?([r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-])[.+@]?$/.exec(t);
  if (sym) {
    const s = sym[2]!;
    let mode = 0;
    WHO.forEach((who, i) => {
      const [r, w, x] = s.slice(i * 3, i * 3 + 3);
      if (r === "r") mode |= bit(who, "r");
      if (w === "w") mode |= bit(who, "w");
      if (x === "x" || x === "s" || x === "t") mode |= bit(who, "x");
      if (x === "s" || x === "S") mode |= who === "u" ? SETUID : SETGID;
      if (x === "t" || x === "T") mode |= STICKY;
    });
    return { mode, form: "symbolic" };
  }

  // chmod clauses: [ugoa]*[+-=][rwxst]* joined by commas
  let mode = 0;
  for (const part of t.split(",")) {
    const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(part.trim());
    if (!m)
      throw new ModeError(
        '"{value}" isn\'t a mode. Use 755, rwxr-xr-x or u=rwx,g=rx,o=rx.',
        {
          value: part.trim() || t,
        },
      );
    const [, whoTxt, op, perms] = m as unknown as [
      string,
      string,
      string,
      string,
    ];
    if (perms.includes("X"))
      throw new ModeError(
        "X depends on the file (it only applies to folders), so it can't be worked out here. Use x.",
      );
    const whos: Who[] =
      !whoTxt || whoTxt.includes("a")
        ? WHO
        : WHO.filter((w) => whoTxt.includes(w));
    let mask = 0;
    let set = 0;
    for (const who of whos) {
      mask |= bit(who, "r") | bit(who, "w") | bit(who, "x");
      if (perms.includes("r")) set |= bit(who, "r");
      if (perms.includes("w")) set |= bit(who, "w");
      if (perms.includes("x")) set |= bit(who, "x");
      if (perms.includes("s") && who === "u") set |= SETUID;
      if (perms.includes("s") && who === "g") set |= SETGID;
    }
    if (whos.includes("u")) mask |= SETUID;
    if (whos.includes("g")) mask |= SETGID;
    if (perms.includes("t")) set |= STICKY;
    if (whos.includes("o") || perms.includes("t")) mask |= STICKY;
    if (op === "+") mode |= set;
    else if (op === "-") mode &= ~set;
    else mode = (mode & ~mask) | set;
  }
  return { mode, form: "clauses" };
}

/** Common modes, with what each is for */
export const PRESETS: [string, string][] = [
  ["644", "Owner can read and write, everyone else can read. Normal files."],
  [
    "755",
    "Owner can do anything, everyone else can read and run. Scripts, programs and folders.",
  ],
  ["600", "Only the owner can read and write. Private keys and secrets."],
  ["700", "Only the owner can do anything. Private folders and scripts."],
  [
    "664",
    "Owner and group can read and write, others can read. Shared project files.",
  ],
  [
    "775",
    "Owner and group can do anything, others can read and run. Shared folders.",
  ],
  [
    "777",
    "Everyone can do everything. Avoid this: anyone on the system can change the file.",
  ],
  [
    "1777",
    "Everyone can add files, but only owners can delete their own. Shared folders like /tmp.",
  ],
];
