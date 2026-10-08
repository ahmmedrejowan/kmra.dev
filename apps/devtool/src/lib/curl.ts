/**
 * cURL commands → a request description → code (fetch, axios, Python requests, Go net/http,
 * PHP cURL). The tokenizer follows POSIX shell quoting: '…', "…" with backslash escapes,
 * $'…' and backslash line continuations (also Windows ^ and PowerShell ` continuations).
 * Messages are English; the tool translates them.
 */

export class CurlError extends Error {
  index?: number;
  /** The offending text, shown after the message */
  detail?: string;
  constructor(message: string, index?: number, detail?: string) {
    super(message);
    this.index = index;
    this.detail = detail;
  }
}

export interface FormField {
  name: string;
  value: string;
  /** -F name=@path: a file to upload */
  file?: string;
}

export interface Request {
  method: string;
  url: string;
  headers: [string, string][];
  /** Raw body text (data, JSON) */
  body: string | null;
  /** The body is JSON (by --json or a JSON content type) */
  json: unknown;
  form: FormField[] | null;
  auth: [string, string] | null;
  insecure: boolean;
  follow: boolean;
  compressed: boolean;
  /** Things to know: [message, the option or path it's about] */
  notes: [string, string][];
}

export function tokenize(src: string): string[] {
  // Same length, so error positions still point into the original text
  const s = src.replace(/\\\r?\n|\^\r?\n|`\r?\n/g, (m) => " ".repeat(m.length));
  const out: string[] = [];
  let i = 0;
  let cur: string | null = null;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      if (cur !== null) out.push(cur);
      cur = null;
      i++;
      continue;
    }
    cur ??= "";
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end < 0) throw new CurlError("A single quote isn't closed.", i);
      cur += s.slice(i + 1, end);
      i = end + 1;
    } else if (c === "$" && s[i + 1] === "'") {
      let j = i + 2;
      let v = "";
      for (; j < s.length && s[j] !== "'"; j++) {
        if (s[j] === "\\" && j + 1 < s.length) {
          const e = s[++j]!;
          const map: Record<string, string> = {
            n: "\n",
            t: "\t",
            r: "\r",
            "0": "\0",
          };
          v += map[e] ?? e;
        } else v += s[j];
      }
      if (j >= s.length) throw new CurlError("A single quote isn't closed.", i);
      cur += v;
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      let v = "";
      for (; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === "\\" && /["\\$`\n]/.test(s[j + 1] ?? "")) v += s[++j];
        else v += s[j];
      }
      if (j >= s.length) throw new CurlError("A double quote isn't closed.", i);
      cur += v;
      i = j + 1;
    } else if (c === "\\" && i + 1 < s.length) {
      cur += s[i + 1];
      i += 2;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}

/** Options that take a value but don't change the request */
const SKIP_VALUE = new Set([
  "-o",
  "--output",
  "-m",
  "--max-time",
  "--connect-timeout",
  "--retry",
  "-w",
  "--write-out",
  "-x",
  "--proxy",
  "--cacert",
  "--cert",
  "-E",
  "--key",
  "--cert-type",
  "-c",
  "--cookie-jar",
  "-D",
  "--dump-header",
  "--retry-delay",
  "--retry-max-time",
  "-Y",
  "--speed-limit",
  "-y",
  "--speed-time",
  "--limit-rate",
  "-r",
  "--range",
  "--resolve",
  "--interface",
  "--max-redirs",
  "-z",
  "--time-cond",
  "--trace",
  "--trace-ascii",
  "--stderr",
  "-K",
  "--config",
]);
/** Flags without a value that don't change the request */
const SKIP_FLAG = new Set([
  "-s",
  "--silent",
  "-S",
  "--show-error",
  "-v",
  "--verbose",
  "-i",
  "--include",
  "-f",
  "--fail",
  "--fail-with-body",
  "-#",
  "--progress-bar",
  "-N",
  "--no-buffer",
  "-O",
  "--remote-name",
  "-J",
  "--remote-header-name",
  "--http1.1",
  "--http2",
  "--http1.0",
  "-q",
  "--disable",
  "--no-progress-meter",
  "-n",
  "--netrc",
  "-4",
  "-6",
  "--ipv4",
  "--ipv6",
  "--globoff",
  "-g",
  "--tcp-nodelay",
  "--path-as-is",
]);
const SHORT_WITH_VALUE = new Set("XHdFuAbeoTmwxEcDrYyzKt".split(""));

export function parseCurl(src: string): Request {
  const toks = tokenize(src);
  if (!toks.length || !/^curl(\.exe)?$/i.test(toks[0]!))
    throw new CurlError("Start with curl, e.g. curl https://example.com", 0);
  let method: string | null = null;
  let url: string | null = null;
  const headers: [string, string][] = [];
  const data: string[] = [];
  let jsonFlag = false;
  const form: FormField[] = [];
  let auth: [string, string] | null = null;
  let get = false;
  let head = false;
  let insecure = false;
  let follow = false;
  let compressed = false;
  const notes: [string, string][] = [];
  const cookies: string[] = [];
  let ua: string | null = null;
  let referer: string | null = null;

  // Expand bundled short flags (-sSL, -XPOST, -H'…')
  const args: string[] = [];
  for (const t of toks.slice(1)) {
    if (/^-[A-Za-z#]{2,}$/.test(t) || /^-[A-Za-z]./.test(t)) {
      let k = 1;
      for (; k < t.length; k++) {
        const f = t[k]!;
        if (SHORT_WITH_VALUE.has(f)) {
          args.push(`-${f}`);
          if (k + 1 < t.length) args.push(t.slice(k + 1));
          k = t.length;
          break;
        }
        args.push(`-${f}`);
      }
    } else args.push(t);
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const val = () => {
      const v = args[++i];
      if (v === undefined)
        throw new CurlError("This option needs a value:", undefined, a);
      return v;
    };
    switch (a) {
      case "-X":
      case "--request":
        method = val().toUpperCase();
        break;
      case "-H":
      case "--header": {
        const h = val();
        const c = h.indexOf(":");
        if (c > 0) {
          const v = h.slice(c + 1).trim();
          if (v) headers.push([h.slice(0, c).trim(), v]);
        } else if (h.endsWith(";")) headers.push([h.slice(0, -1).trim(), ""]);
        break;
      }
      case "-d":
      case "--data":
      case "--data-ascii": {
        const v = val();
        if (v.startsWith("@"))
          notes.push(["The body is read from a file:", v.slice(1)]);
        // Like curl, -d drops line breaks
        data.push(v.replace(/[\r\n]/g, ""));
        break;
      }
      case "--data-raw":
        data.push(val());
        break;
      case "--data-binary": {
        const v = val();
        if (v.startsWith("@"))
          notes.push(["The body is read from a file:", v.slice(1)]);
        data.push(v);
        break;
      }
      case "--data-urlencode": {
        const v = val();
        const eq = v.indexOf("=");
        data.push(
          eq < 0
            ? encodeURIComponent(v)
            : eq === 0
              ? encodeURIComponent(v.slice(1))
              : `${v.slice(0, eq)}=${encodeURIComponent(v.slice(eq + 1))}`,
        );
        break;
      }
      case "--json":
        data.push(val());
        jsonFlag = true;
        break;
      case "-F":
      case "--form":
      case "--form-string": {
        const v = val();
        const eq = v.indexOf("=");
        if (eq < 0)
          throw new CurlError("A form field needs name=value:", undefined, v);
        const name = v.slice(0, eq);
        let value = v.slice(eq + 1);
        if (a !== "--form-string" && value.startsWith("@")) {
          const path = value.slice(1).split(";")[0]!;
          form.push({ name, value: path, file: path });
        } else {
          if (a !== "--form-string" && value.startsWith("<")) {
            notes.push(["A form field is read from a file:", value.slice(1)]);
          }
          value = a === "--form-string" ? value : value.split(";type=")[0]!;
          form.push({ name, value });
        }
        break;
      }
      case "-u":
      case "--user": {
        const v = val();
        const c = v.indexOf(":");
        auth = c < 0 ? [v, ""] : [v.slice(0, c), v.slice(c + 1)];
        break;
      }
      case "-b":
      case "--cookie": {
        const v = val();
        if (v.includes("=")) cookies.push(v);
        else notes.push(["Cookies are read from a file:", v]);
        break;
      }
      case "-A":
      case "--user-agent":
        ua = val();
        break;
      case "-e":
      case "--referer":
        referer = val();
        break;
      case "-k":
      case "--insecure":
        insecure = true;
        break;
      case "-L":
      case "--location":
        follow = true;
        break;
      case "--compressed":
        compressed = true;
        break;
      case "-G":
      case "--get":
        get = true;
        break;
      case "-I":
      case "--head":
        head = true;
        break;
      case "--url":
        url = val();
        break;
      default:
        if (SKIP_VALUE.has(a)) i++;
        else if (SKIP_FLAG.has(a)) {
          /* no effect on the request */
        } else if (a.startsWith("-")) notes.push(["Skipped an option:", a]);
        else if (url === null) url = a;
        else notes.push(["Skipped an extra argument:", a]);
    }
  }
  if (!url) throw new CurlError("There's no URL in the command.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;

  const has = (n: string) =>
    headers.some(([k]) => k.toLowerCase() === n.toLowerCase());
  if (ua && !has("User-Agent")) headers.push(["User-Agent", ua]);
  if (referer && !has("Referer")) headers.push(["Referer", referer]);
  if (cookies.length && !has("Cookie"))
    headers.push(["Cookie", cookies.join("; ")]);

  let body: string | null = data.length ? data.join("&") : null;
  if (get && body !== null) {
    url += (url.includes("?") ? "&" : "?") + body;
    body = null;
  }
  if (jsonFlag) {
    if (!has("Content-Type"))
      headers.push(["Content-Type", "application/json"]);
    if (!has("Accept")) headers.push(["Accept", "application/json"]);
  } else if (body !== null && !has("Content-Type"))
    headers.push(["Content-Type", "application/x-www-form-urlencoded"]);

  let json: unknown = undefined;
  const ct =
    headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  if (body !== null && /json/i.test(ct)) {
    try {
      json = JSON.parse(body);
    } catch {
      /* sent as text */
    }
  }

  const m =
    method ?? (head ? "HEAD" : body !== null || form.length ? "POST" : "GET");
  return {
    method: m,
    url,
    headers,
    body,
    json,
    form: form.length ? form : null,
    auth,
    insecure,
    follow,
    compressed,
    notes,
  };
}

/* ---------- code ---------- */

const q = (s: string) => JSON.stringify(s);
const ind = (s: string, n: number) => s.replace(/\n/g, "\n" + " ".repeat(n));

function basic([u, p]: [string, string]) {
  const raw = `${u}:${p}`;
  try {
    return btoa(raw);
  } catch {
    return btoa(String.fromCharCode(...new TextEncoder().encode(raw)));
  }
}

/** Headers with Basic auth folded in (for clients without an auth option) */
function withAuth(r: Request): [string, string][] {
  return r.auth && !r.headers.some(([k]) => /^authorization$/i.test(k))
    ? [...r.headers, ["Authorization", `Basic ${basic(r.auth)}`]]
    : r.headers;
}

const multipartless = (r: Request) =>
  r.form ? r.headers.filter(([k]) => !/^content-type$/i.test(k)) : r.headers;

export function toFetch(r: Request): string {
  const lines: string[] = [];
  const opts: string[] = [];
  if (r.method !== "GET") opts.push(`method: ${q(r.method)}`);
  const hs = multipartless({ ...r, headers: withAuth(r) });
  if (hs.length)
    opts.push(
      `headers: {\n${hs.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join("\n")}\n  }`,
    );
  if (r.form) {
    lines.push("const form = new FormData();");
    for (const f of r.form)
      lines.push(
        f.file
          ? `form.append(${q(f.name)}, fileInput.files[0]); // ${f.file}`
          : `form.append(${q(f.name)}, ${q(f.value)});`,
      );
    lines.push("");
    opts.push("body: form");
  } else if (r.json !== undefined)
    opts.push(
      `body: JSON.stringify(${ind(JSON.stringify(r.json, null, 2), 2)})`,
    );
  else if (r.body !== null) opts.push(`body: ${q(r.body)}`);
  if (r.insecure)
    lines.push("// fetch always checks certificates; there's no -k equivalent");
  lines.push(
    opts.length
      ? `const res = await fetch(${q(r.url)}, {\n  ${opts.join(",\n  ")},\n});`
      : `const res = await fetch(${q(r.url)});`,
  );
  lines.push(
    "const data = await res.text();",
    "console.log(res.status, data);",
  );
  return lines.join("\n") + "\n";
}

export function toAxios(r: Request): string {
  const lines = ['import axios from "axios";', ""];
  const opts: string[] = [
    `method: ${q(r.method.toLowerCase())}`,
    `url: ${q(r.url)}`,
  ];
  const hs = multipartless(r);
  if (hs.length)
    opts.push(
      `headers: {\n${hs.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join("\n")}\n  }`,
    );
  if (r.auth)
    opts.push(`auth: { username: ${q(r.auth[0])}, password: ${q(r.auth[1])} }`);
  if (r.form) {
    lines.push("const form = new FormData();");
    for (const f of r.form)
      lines.push(
        f.file
          ? `form.append(${q(f.name)}, fileInput.files[0]); // ${f.file}`
          : `form.append(${q(f.name)}, ${q(f.value)});`,
      );
    lines.push("");
    opts.push("data: form");
  } else if (r.json !== undefined)
    opts.push(`data: ${ind(JSON.stringify(r.json, null, 2), 2)}`);
  else if (r.body !== null) opts.push(`data: ${q(r.body)}`);
  if (r.insecure)
    lines.push(
      'import https from "node:https"; // Node only, to skip certificate checks like -k',
    );
  if (r.insecure)
    opts.push("httpsAgent: new https.Agent({ rejectUnauthorized: false })");
  lines.push(
    `const res = await axios({\n  ${opts.join(",\n  ")},\n});`,
    "console.log(res.status, res.data);",
  );
  // Imports first
  const imports = lines.filter((l) => l.startsWith("import "));
  const rest = lines.filter((l) => !l.startsWith("import "));
  return [...imports, ...rest].join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function py(v: unknown, d = 0): string {
  const pad = "    ".repeat(d + 1);
  const end = "    ".repeat(d);
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v))
    return v.length
      ? `[\n${v.map((x) => pad + py(x, d + 1)).join(",\n")},\n${end}]`
      : "[]";
  const e = Object.entries(v as object);
  return e.length
    ? `{\n${e.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${py(x, d + 1)}`).join(",\n")},\n${end}}`
    : "{}";
}

export function toPython(r: Request): string {
  const lines = ["import requests", ""];
  const args = [q(r.url)];
  const hs = multipartless(r);
  if (hs.length) {
    lines.push(`headers = ${py(Object.fromEntries(hs))}`, "");
    args.push("headers=headers");
  }
  if (r.form) {
    const files = r.form.filter((f) => f.file);
    const data = r.form.filter((f) => !f.file);
    if (data.length) {
      lines.push(
        `data = ${py(Object.fromEntries(data.map((f) => [f.name, f.value])))}`,
        "",
      );
      args.push("data=data");
    }
    if (files.length) {
      lines.push(
        `files = {\n${files.map((f) => `    ${q(f.name)}: open(${q(f.file!)}, "rb"),`).join("\n")}\n}`,
        "",
      );
      args.push("files=files");
    }
  } else if (r.json !== undefined) {
    lines.push(`json_data = ${py(r.json)}`, "");
    args.push("json=json_data");
  } else if (r.body !== null) {
    lines.push(`data = ${q(r.body)}`, "");
    args.push("data=data");
  }
  if (r.auth) args.push(`auth=(${q(r.auth[0])}, ${q(r.auth[1])})`);
  if (r.insecure) args.push("verify=False");
  const fn = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
  ].includes(r.method)
    ? `requests.${r.method.toLowerCase()}(`
    : `requests.request(${q(r.method)}, `;
  lines.push(
    `response = ${fn}${args.length > 2 ? "\n    " + args.join(",\n    ") + ",\n" : args.join(", ")})`,
    "print(response.status_code, response.text)",
  );
  return lines.join("\n") + "\n";
}

const goStr = (s: string) =>
  /[`\r]/.test(s) || !/\n/.test(s) ? q(s) : "`" + s + "`";

export function toGo(r: Request): string {
  const imports = new Set(["fmt", "io", "net/http"]);
  const body: string[] = [];
  let reader = "nil";
  if (r.form) {
    imports.add("bytes");
    imports.add("mime/multipart");
    body.push("\tvar buf bytes.Buffer", "\tw := multipart.NewWriter(&buf)");
    for (const f of r.form) {
      if (f.file) {
        imports.add("os");
        imports.add("path/filepath");
        body.push(
          `\tf, err := os.Open(${q(f.file)})`,
          "\tif err != nil {\n\t\tpanic(err)\n\t}",
          "\tdefer f.Close()",
          `\tpart, err := w.CreateFormFile(${q(f.name)}, filepath.Base(f.Name()))`,
          "\tif err != nil {\n\t\tpanic(err)\n\t}",
          "\tio.Copy(part, f)",
        );
      } else body.push(`\tw.WriteField(${q(f.name)}, ${q(f.value)})`);
    }
    body.push("\tw.Close()", "");
    reader = "&buf";
  } else if (r.body !== null) {
    imports.add("strings");
    const text =
      r.json !== undefined ? JSON.stringify(r.json, null, 2) : r.body;
    body.push(`\tbody := strings.NewReader(${goStr(text)})`, "");
    reader = "body";
  }
  body.push(
    `\treq, err := http.NewRequest(${q(r.method)}, ${q(r.url)}, ${reader})`,
    "\tif err != nil {\n\t\tpanic(err)\n\t}",
  );
  for (const [k, v] of multipartless(r))
    body.push(`\treq.Header.Set(${q(k)}, ${q(v)})`);
  if (r.form)
    body.push('\treq.Header.Set("Content-Type", w.FormDataContentType())');
  if (r.auth) body.push(`\treq.SetBasicAuth(${q(r.auth[0])}, ${q(r.auth[1])})`);
  body.push("");
  const client: string[] = [];
  if (r.insecure) {
    imports.add("crypto/tls");
    client.push(
      "\t\tTransport: &http.Transport{\n\t\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},\n\t\t},",
    );
  }
  body.push(
    client.length
      ? `\tclient := &http.Client{\n${client.join("\n")}\n\t}`
      : "\tclient := &http.Client{}",
    "\tres, err := client.Do(req)",
    "\tif err != nil {\n\t\tpanic(err)\n\t}",
    "\tdefer res.Body.Close()",
    "",
    "\tdata, err := io.ReadAll(res.Body)",
    "\tif err != nil {\n\t\tpanic(err)\n\t}",
    "\tfmt.Println(res.StatusCode, string(data))",
  );
  return [
    "package main",
    "",
    `import (\n${[...imports]
      .sort()
      .map((i) => `\t${q(i)}`)
      .join("\n")}\n)`,
    "",
    "func main() {",
    ...body,
    "}",
    "",
  ].join("\n");
}

const php = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export function toPhp(r: Request): string {
  const o: string[] = [
    `CURLOPT_URL => ${php(r.url)}`,
    "CURLOPT_RETURNTRANSFER => true",
  ];
  if (r.method === "HEAD") o.push("CURLOPT_NOBODY => true");
  else if (r.method !== "GET" || r.body !== null || r.form)
    o.push(`CURLOPT_CUSTOMREQUEST => ${php(r.method)}`);
  const hs = multipartless(r);
  if (hs.length)
    o.push(
      `CURLOPT_HTTPHEADER => [\n${hs.map(([k, v]) => `        ${php(`${k}: ${v}`)},`).join("\n")}\n    ]`,
    );
  if (r.form)
    o.push(
      `CURLOPT_POSTFIELDS => [\n${r.form
        .map((f) =>
          f.file
            ? `        ${php(f.name)} => new CURLFile(${php(f.file)}),`
            : `        ${php(f.name)} => ${php(f.value)},`,
        )
        .join("\n")}\n    ]`,
    );
  else if (r.body !== null) o.push(`CURLOPT_POSTFIELDS => ${php(r.body)}`);
  if (r.auth) o.push(`CURLOPT_USERPWD => ${php(`${r.auth[0]}:${r.auth[1]}`)}`);
  if (r.follow) o.push("CURLOPT_FOLLOWLOCATION => true");
  if (r.compressed) o.push("CURLOPT_ENCODING => ''");
  if (r.insecure)
    o.push("CURLOPT_SSL_VERIFYPEER => false", "CURLOPT_SSL_VERIFYHOST => 0");
  return [
    "<?php",
    "",
    "$ch = curl_init();",
    `curl_setopt_array($ch, [\n    ${o.join(",\n    ")},\n]);`,
    "",
    "$response = curl_exec($ch);",
    "if ($response === false) {",
    "    echo curl_error($ch);",
    "}",
    "$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);",
    "curl_close($ch);",
    "",
    "echo $status, PHP_EOL, $response;",
    "",
  ].join("\n");
}

export const LANGS = {
  fetch: { label: "fetch", file: "request.js", gen: toFetch },
  axios: { label: "axios", file: "request.js", gen: toAxios },
  python: { label: "Python", file: "request.py", gen: toPython },
  go: { label: "Go", file: "main.go", gen: toGo },
  php: { label: "PHP", file: "request.php", gen: toPhp },
} as const;
export type Lang = keyof typeof LANGS;
