/**
 * A small expression calculator (no eval: the CSP forbids it, and it would be unsafe anyway).
 *
 *   + − × ÷ * / ^ ( )   2(3) and 2π multiply   √9  sqrt cbrt  sin cos tan (degrees or radians)
 *   asin acos atan  log (base 10)  ln  abs  round  floor  ceil   π pi e  ans   5!   10%
 *
 * Percentages work like a phone calculator: "200 + 10%" adds 10% of 200 (= 220), "200 × 10%"
 * is 20, and "12% of 250" is 30.
 */

export class CalcError extends Error {
  /** True when the sum is just unfinished ("2 +"), not wrong */
  incomplete: boolean;
  vars?: Record<string, string>;
  /** `message` is an English key, translated by the caller */
  constructor(
    message: string,
    incomplete = false,
    vars?: Record<string, string>,
  ) {
    super(message);
    this.incomplete = incomplete;
    this.vars = vars;
  }
}

type Tok =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "id"; v: string }
  | { t: "("; v: "(" }
  | { t: ")"; v: ")" };

const FUNCS = new Set([
  "sqrt",
  "cbrt",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "abs",
  "round",
  "floor",
  "ceil",
]);
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E };

/** Normalise what people type: × ÷ −, Bangla digits, commas as thousands separators. */
export function normalise(src: string): string {
  return src
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[×xX✕·]/g, (m, i: number, s: string) =>
      // "x" is multiply only between numbers/brackets ("2x3"), so "exp" etc. stay words
      m === "x" || m === "X"
        ? /[\d.)πe%!]\s*$/.test(s.slice(0, i)) &&
          /^\s*[\d.(π√]/.test(s.slice(i + 1))
          ? "*"
          : m
        : "*",
    )
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/(\d),(?=\d{3}(\D|$))/g, "$1");
}

export function tokenize(src: string): Tok[] {
  const s = normalise(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
    if (num && !(num[0] === "." && !/\d/.test(s[i + 1] ?? ""))) {
      // "2e" followed by a letter is 2 × e, not an exponent
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    if ("+-*/^%!".includes(c)) {
      out.push({ t: "op", v: c === "*" && s[i + 1] === "*" ? "^" : c });
      i += c === "*" && s[i + 1] === "*" ? 2 : 1;
      continue;
    }
    if (c === "(" || c === "[") {
      out.push({ t: "(", v: "(" });
      i++;
      continue;
    }
    if (c === ")" || c === "]") {
      out.push({ t: ")", v: ")" });
      i++;
      continue;
    }
    if (c === "√" || c === "∛") {
      out.push({ t: "id", v: c === "√" ? "sqrt" : "cbrt" });
      i++;
      continue;
    }
    if (c === "π") {
      out.push({ t: "id", v: "pi" });
      i++;
      continue;
    }
    const word = /^[a-z]+/i.exec(s.slice(i));
    if (word) {
      const w = word[0].toLowerCase();
      if (w === "of") out.push({ t: "op", v: "*" });
      else if (w === "mod") out.push({ t: "op", v: "mod" });
      else if (FUNCS.has(w) || w in CONSTS || w === "ans")
        out.push({ t: "id", v: w });
      else
        throw new CalcError(
          "“{w}” isn't something this calculator knows.",
          false,
          {
            w: word[0],
          },
        );
      i += word[0].length;
      continue;
    }
    if (c === ".") throw new CalcError("The sum isn't finished yet.", true);
    throw new CalcError("“{w}” isn't something this calculator knows.", false, {
      w: c,
    });
  }
  return out;
}

interface Val {
  v: number;
  /** A bare percentage ("10%"), which + and − read as a share of the left side */
  pct?: boolean;
}

export interface EvalOptions {
  /** Angles in degrees (default) or radians */
  deg?: boolean;
  /** Value of `ans` (the last answer) */
  ans?: number;
}

/** Evaluate an expression. Unclosed brackets at the end are closed for you. */
export function evaluate(src: string, opts: EvalOptions = {}): number {
  const toks = tokenize(src);
  if (!toks.length) throw new CalcError("Type a sum.", true);
  const deg = opts.deg ?? true;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => {
    const t = toks[p];
    return t?.t === "op" && t.v === v;
  };
  const end = () => new CalcError("The sum isn't finished yet.", true);

  function add(): Val {
    let left = mul();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const right = mul();
      const r = right.pct ? left.v * right.v : right.v;
      left = { v: op === "+" ? left.v + r : left.v - r };
    }
    return left;
  }

  function startsFactor(t: Tok | undefined) {
    return !!t && (t.t === "num" || t.t === "id" || t.t === "(");
  }

  function mul(): Val {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/") || isOp("mod")) {
        const op = (toks[p++] as { v: string }).v;
        const right = unary();
        if (op === "*") left = { v: left.v * right.v };
        else if (op === "/") {
          if (right.v === 0) throw new CalcError("You can't divide by zero.");
          left = { v: left.v / right.v };
        } else {
          if (right.v === 0) throw new CalcError("You can't divide by zero.");
          left = { v: left.v - right.v * Math.floor(left.v / right.v) };
        }
      } else if (
        startsFactor(peek()) &&
        (peek()!.t !== "num" || toks[p - 1]?.t === ")")
      ) {
        // Implicit multiplication: 2(3), 2π, (1+2)(3), 3√4
        const right = unary();
        left = { v: left.v * right.v, pct: left.pct && right.pct };
      } else return left;
    }
  }

  function unary(): Val {
    if (isOp("-")) {
      p++;
      const v = unary();
      return { v: -v.v, pct: v.pct };
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return pow();
  }

  function pow(): Val {
    const base = postfix();
    if (isOp("^")) {
      p++;
      const ex = unary(); // right-associative, allows 2^-1
      const v = Math.pow(base.v, ex.v);
      if (Number.isNaN(v))
        throw new CalcError("That power has no real answer.");
      return { v };
    }
    return base;
  }

  function postfix(): Val {
    let x = primary();
    for (;;) {
      if (isOp("%")) {
        p++;
        x = { v: x.v / 100, pct: true };
      } else if (isOp("!")) {
        p++;
        x = { v: factorial(x.v) };
      } else return x;
    }
  }

  function primary(): Val {
    const t = toks[p];
    if (!t) throw end();
    if (t.t === "num") {
      p++;
      return { v: t.v };
    }
    if (t.t === "(") {
      p++;
      const v = add();
      if (toks[p]?.t === ")") p++;
      else if (p < toks.length) throw new CalcError("Check the brackets.");
      return { v: v.v };
    }
    if (t.t === "id") {
      p++;
      if (t.v === "ans") return { v: opts.ans ?? 0 };
      if (t.v in CONSTS) return { v: CONSTS[t.v]! };
      // A function: takes a bracketed group or the next factor (√9, sin 30)
      const arg =
        toks[p]?.t === "("
          ? primary()
          : isOp("-") || isOp("+")
            ? unary()
            : postfix();
      return { v: call(t.v, arg.v, deg) };
    }
    if (t.t === ")") throw new CalcError("Check the brackets.");
    throw end();
  }

  const v = add();
  if (p < toks.length) {
    const t = toks[p]!;
    throw t.t === ")"
      ? new CalcError("Check the brackets.")
      : new CalcError("The sum isn't finished yet.", true);
  }
  if (!Number.isFinite(v.v))
    throw new CalcError("The answer is too big to show.");
  return v.v === 0 ? 0 : v.v; // no "-0"
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n))
    throw new CalcError("Factorials work on whole numbers from 0 up.");
  if (n > 170) throw new CalcError("The answer is too big to show.");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function call(f: string, x: number, deg: boolean): number {
  const rad = deg ? (x * Math.PI) / 180 : x;
  const back = (r: number) => (deg ? (r * 180) / Math.PI : r);
  // sin(180°) should be exactly 0, not 1.2e-16
  const snap = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  switch (f) {
    case "sqrt":
      if (x < 0)
        throw new CalcError("Negative numbers have no real square root.");
      return Math.sqrt(x);
    case "cbrt":
      return Math.cbrt(x);
    case "sin":
      return snap(Math.sin(rad));
    case "cos":
      return snap(Math.cos(rad));
    case "tan": {
      if (deg && Math.abs((((x % 180) + 180) % 180) - 90) < 1e-9)
        throw new CalcError("tan isn't defined there.");
      return snap(Math.tan(rad));
    }
    case "asin":
    case "acos":
      if (x < -1 || x > 1)
        throw new CalcError("asin and acos take values from −1 to 1.");
      return back(f === "asin" ? Math.asin(x) : Math.acos(x));
    case "atan":
      return back(Math.atan(x));
    case "log":
    case "ln":
      if (x <= 0) throw new CalcError("Logarithms need a number above 0.");
      return f === "log" ? Math.log10(x) : Math.log(x);
    case "abs":
      return Math.abs(x);
    case "round":
      return Math.round(x);
    case "floor":
      return Math.floor(x);
    case "ceil":
      return Math.ceil(x);
  }
  throw new CalcError("“{w}” isn't something this calculator knows.", false, {
    w: f,
  });
}

/** Result for display: the value, or a friendly message. */
export function tryEval(
  src: string,
  opts?: EvalOptions,
):
  | { ok: true; v: number }
  | {
      ok: false;
      message: string;
      vars?: Record<string, string>;
      incomplete: boolean;
    } {
  try {
    return { ok: true, v: evaluate(src, opts) };
  } catch (e) {
    if (e instanceof CalcError)
      return {
        ok: false,
        message: e.message,
        vars: e.vars,
        incomplete: e.incomplete,
      };
    throw e;
  }
}
