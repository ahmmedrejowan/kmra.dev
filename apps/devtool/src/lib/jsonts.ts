/**
 * TypeScript declarations inferred from sample JSON. Objects become named interfaces (names
 * from their keys in PascalCase), objects in an array are merged so keys missing from some of
 * them become optional, mixed arrays become unions, and null adds `| null`.
 */

type Ty =
  | { k: "prim"; name: "string" | "number" | "boolean" | "null" }
  | { k: "obj"; fields: Map<string, { t: Ty; opt: boolean }> }
  | { k: "arr"; of: Ty | null }
  | { k: "union"; of: Ty[] };

function infer(v: unknown): Ty {
  if (v === null) return { k: "prim", name: "null" };
  if (Array.isArray(v))
    return {
      k: "arr",
      of: v.length ? v.map(infer).reduce((a, b) => merge(a, b)) : null,
    };
  if (typeof v === "object") {
    const fields = new Map<string, { t: Ty; opt: boolean }>();
    for (const [key, x] of Object.entries(v as object))
      fields.set(key, { t: infer(x), opt: false });
    return { k: "obj", fields };
  }
  return {
    k: "prim",
    name:
      typeof v === "number"
        ? "number"
        : typeof v === "boolean"
          ? "boolean"
          : "string",
  };
}

function members(t: Ty): Ty[] {
  return t.k === "union" ? t.of : [t];
}

/** Two samples of the same place in the JSON → one type that fits both */
function merge(a: Ty, b: Ty): Ty {
  const all = [...members(a), ...members(b)];
  const out: Ty[] = [];
  for (const t of all) {
    const same = out.findIndex(
      (o) =>
        o.k === t.k &&
        (o.k !== "prim" || (t.k === "prim" && o.name === t.name)),
    );
    if (same < 0) {
      out.push(t);
      continue;
    }
    const o = out[same]!;
    if (o.k === "obj" && t.k === "obj") out[same] = mergeObj(o, t);
    else if (o.k === "arr" && t.k === "arr")
      out[same] = {
        k: "arr",
        of: o.of && t.of ? merge(o.of, t.of) : (o.of ?? t.of),
      };
  }
  return out.length === 1 ? out[0]! : { k: "union", of: out };
}

function mergeObj(
  a: Extract<Ty, { k: "obj" }>,
  b: Extract<Ty, { k: "obj" }>,
): Ty {
  const fields = new Map<string, { t: Ty; opt: boolean }>();
  for (const [key, f] of a.fields) {
    const g = b.fields.get(key);
    fields.set(
      key,
      g ? { t: merge(f.t, g.t), opt: f.opt || g.opt } : { t: f.t, opt: true },
    );
  }
  for (const [key, g] of b.fields)
    if (!a.fields.has(key)) fields.set(key, { t: g.t, opt: true });
  return { k: "obj", fields };
}

export function pascal(s: string): string {
  const p = s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");
  if (!p) return "Item";
  return /^\d/.test(p) ? `T${p}` : p;
}

/** "users" → "User", "categories" → "Category" (simple English plurals only) */
function singular(s: string): string {
  if (/ies$/i.test(s) && s.length > 4) return s.slice(0, -3) + "y";
  if (/(ss|us|is)$/i.test(s)) return s;
  if (/(x|ch|sh|ses)es$/i.test(s)) return s.slice(0, -2);
  if (/s$/i.test(s) && s.length > 3) return s.slice(0, -1);
  return s;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface TsOptions {
  root: string;
  style: "interface" | "type";
  exported: boolean;
  readonly: boolean;
}

export function jsonToTs(value: unknown, o: TsOptions): string {
  const root = pascal(o.root || "Root");
  const decls: string[] = [];
  const used = new Set<string>();
  /** Same shape → same name, so repeated structures aren't declared twice */
  const bySig = new Map<string, string>();
  const ex = o.exported ? "export " : "";
  const ro = o.readonly ? "readonly " : "";

  function unique(name: string) {
    let n = name;
    for (let i = 2; used.has(n); i++) n = `${name}${i}`;
    used.add(n);
    return n;
  }

  function sig(t: Ty): string {
    switch (t.k) {
      case "prim":
        return t.name;
      case "arr":
        return `[${t.of ? sig(t.of) : "?"}]`;
      case "union":
        return t.of.map(sig).sort().join("|");
      case "obj":
        return `{${[...t.fields]
          .map(([k, f]) => `${k}${f.opt ? "?" : ""}:${sig(f.t)}`)
          .join(",")}}`;
    }
  }

  function render(t: Ty, hint: string): string {
    switch (t.k) {
      case "prim":
        return t.name;
      case "arr": {
        const inner = t.of ? render(t.of, singular(hint)) : "unknown";
        const wrap =
          t.of?.k === "union" && inner.includes(" | ") ? `(${inner})` : inner;
        return o.readonly ? `readonly ${wrap}[]` : `${wrap}[]`;
      }
      case "union": {
        // null last, as people write it
        const parts = t.of
          .filter((x) => !(x.k === "prim" && x.name === "null"))
          .map((x) => render(x, hint));
        if (t.of.some((x) => x.k === "prim" && x.name === "null"))
          parts.push("null");
        return [...new Set(parts)].join(" | ");
      }
      case "obj":
        return declare(t, pascal(hint));
    }
  }

  function declare(t: Extract<Ty, { k: "obj" }>, want: string): string {
    const s = sig(t);
    const known = bySig.get(s);
    if (known) return known;
    const name = unique(want);
    bySig.set(s, name);
    const slot = decls.length;
    decls.push("");
    const lines = [...t.fields].map(([key, f]) => {
      const k = IDENT.test(key) ? key : JSON.stringify(key);
      return `  ${ro}${k}${f.opt ? "?" : ""}: ${render(f.t, key)};`;
    });
    const body = lines.length ? `{\n${lines.join("\n")}\n}` : "{}";
    decls[slot] =
      o.style === "interface"
        ? `${ex}interface ${name} ${body}`
        : `${ex}type ${name} = ${body};`;
    return name;
  }

  const t = infer(value);
  if (t.k === "obj") declare(t, root);
  else {
    used.add(root);
    // Root arrays name their items "<Root>Item"
    const hint = t.k === "arr" ? `${root}Items` : root;
    decls.unshift(`${ex}type ${root} = ${render(t, hint)};`);
  }
  return decls.filter(Boolean).join("\n\n") + "\n";
}
