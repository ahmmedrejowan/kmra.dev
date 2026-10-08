import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { Locale } from "@kmra/ui/lib/i18n";
import type { ToolProps } from ".";
import {
  BarCheck,
  Pane,
  Workspace,
  useInput,
  type PaneError,
} from "../lib/kit";
import {
  DecodeError,
  fromBase64,
  fromUtf8,
  lineCol,
  toBase64,
  utf8,
} from "../lib/encode";

type Json = Record<string, unknown>;

interface Parsed {
  header: Json;
  payload: Json | null;
  /** The payload as text when it isn't JSON */
  payloadText: string;
  signingInput: string;
  signature: Uint8Array;
}

class JwtError extends Error {
  index?: number;
  constructor(message: string, index?: number) {
    super(message);
    this.index = index;
  }
}

/** Split and decode a token; positions in errors point into `raw` */
function parse(raw: string): Parsed {
  const lead = /^\s*(Bearer\s+)?/i.exec(raw)![0].length;
  const token = raw.slice(lead).trim();
  const parts = token.split(".");
  if (parts.length === 5)
    throw new JwtError(
      "This is an encrypted token (JWE). Only signed tokens can be read without the key.",
    );
  if (parts.length !== 3)
    throw new JwtError(
      "A JWT has three parts separated by dots (header.payload.signature).",
    );
  const starts = [lead, lead + parts[0]!.length + 1];
  starts.push(starts[1]! + parts[1]!.length + 1);
  const bad = [
    "The header isn't valid Base64url.",
    "The payload isn't valid Base64url.",
    "The signature isn't valid Base64url.",
  ];
  const part = (i: number) => {
    if (/[=+/]/.test(parts[i]!) || !parts[i])
      throw new JwtError(bad[i]!, starts[i]);
    try {
      return fromBase64(parts[i]!).bytes;
    } catch (e) {
      throw new JwtError(
        bad[i]!,
        e instanceof DecodeError && e.index !== undefined
          ? starts[i]! + e.index
          : starts[i],
      );
    }
  };
  let header: Json;
  try {
    header = JSON.parse(fromUtf8(part(0)).text) as Json;
    if (!header || typeof header !== "object" || Array.isArray(header)) throw 0;
  } catch (e) {
    if (e instanceof JwtError) throw e;
    throw new JwtError("The header isn't JSON.", starts[0]);
  }
  const payloadText = fromUtf8(part(1)).text;
  let payload: Json | null = null;
  try {
    const v = JSON.parse(payloadText) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) payload = v as Json;
  } catch {}
  const signature = parts[2] ? part(2) : new Uint8Array();
  return {
    header,
    payload,
    payloadText,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature,
  };
}

/* ---------- Signature check (WebCrypto) ---------- */

type Check =
  { state: "ok" } | { state: "bad" } | { state: "error"; message: string };

const HASH: Record<string, string> = {
  "256": "SHA-256",
  "384": "SHA-384",
  "512": "SHA-512",
};

function algParams(alg: string) {
  const bits = alg.slice(2);
  const hash = HASH[bits];
  if (/^HS(256|384|512)$/.test(alg)) return { name: "HMAC", hash };
  if (/^RS(256|384|512)$/.test(alg)) return { name: "RSASSA-PKCS1-v1_5", hash };
  if (/^PS(256|384|512)$/.test(alg))
    return { name: "RSA-PSS", hash, saltLength: +bits / 8 };
  if (/^ES(256|384|512)$/.test(alg))
    return {
      name: "ECDSA",
      hash,
      namedCurve: bits === "512" ? "P-521" : `P-${bits}`,
    };
  if (alg === "EdDSA" || alg === "Ed25519") return { name: "Ed25519" };
  return null;
}

/** Read one DER element: tag, where its content starts and ends */
function tlv(b: Uint8Array, p: number) {
  let len = b[p + 1]!;
  let q = p + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[q++]!;
  }
  return { tag: b[p]!, at: p, start: q, end: q + len };
}

function derLen(n: number): number[] {
  if (n < 128) return [n];
  const out: number[] = [];
  while (n) {
    out.unshift(n & 255);
    n >>= 8;
  }
  return [0x80 | out.length, ...out];
}

/** "BEGIN RSA PUBLIC KEY" (PKCS#1) wrapped as SubjectPublicKeyInfo */
function pkcs1ToSpki(der: Uint8Array): Uint8Array {
  const alg = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ];
  const bits = [0x03, ...derLen(der.length + 1), 0x00, ...der];
  return Uint8Array.from([
    0x30,
    ...derLen(alg.length + bits.length),
    ...alg,
    ...bits,
  ]);
}

/** The public key inside an X.509 certificate */
function certToSpki(der: Uint8Array): Uint8Array {
  const tbs = tlv(der, tlv(der, 0).start);
  let el = tlv(der, tbs.start);
  if (el.tag === 0xa0) el = tlv(der, el.end); // version
  let p = el.end; // after the serial number
  for (let i = 0; i < 4; i++) p = tlv(der, p).end; // algorithm, issuer, validity, subject
  const spki = tlv(der, p);
  return der.slice(spki.at, spki.end);
}

async function importKey(
  text: string,
  params: ReturnType<typeof algParams> & object,
  kid: unknown,
): Promise<CryptoKey> {
  const t = text.trim();
  if (t.startsWith("{")) {
    let jwk = JSON.parse(t) as JsonWebKey & {
      keys?: (JsonWebKey & { kid?: string })[];
    };
    if (jwk.keys) {
      const pick =
        jwk.keys.find((k) => k.kid !== undefined && k.kid === kid) ??
        jwk.keys[0];
      if (!pick) throw new Error("The key set is empty.");
      jwk = pick;
    }
    // Only the public part, so a full key or one with other "key_ops" still imports
    const pub: JsonWebKey = { kty: jwk.kty };
    for (const k of ["n", "e", "crv", "x", "y"] as const)
      if (jwk[k]) pub[k] = jwk[k];
    return crypto.subtle.importKey("jwk", pub, params, false, ["verify"]);
  }
  const m = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(t);
  if (!m)
    throw new Error(
      "Paste a public key as PEM (-----BEGIN PUBLIC KEY-----) or JWK.",
    );
  if (/PRIVATE/.test(m[1]!))
    throw new Error("This is a private key. Paste the public key instead.");
  let der = fromBase64(m[2]!).bytes;
  if (m[1] === "RSA PUBLIC KEY") der = pkcs1ToSpki(der);
  else if (m[1] === "CERTIFICATE") der = certToSpki(der);
  return crypto.subtle.importKey(
    "spki",
    der as Uint8Array<ArrayBuffer>,
    params,
    false,
    ["verify"],
  );
}

async function verify(
  p: Parsed,
  alg: string,
  key: string,
  secretB64: boolean,
): Promise<Check> {
  const params = algParams(alg);
  if (!params) return { state: "error", message: "unsupported" };
  try {
    const k =
      params.name === "HMAC"
        ? await crypto.subtle.importKey(
            "raw",
            (secretB64
              ? fromBase64(key).bytes
              : utf8(key)) as Uint8Array<ArrayBuffer>,
            params,
            false,
            ["verify"],
          )
        : await importKey(key, params, p.header.kid);
    const ok = await crypto.subtle.verify(
      params,
      k,
      p.signature as Uint8Array<ArrayBuffer>,
      utf8(p.signingInput) as Uint8Array<ArrayBuffer>,
    );
    return { state: ok ? "ok" : "bad" };
  } catch (e) {
    return {
      state: "error",
      message: e instanceof Error && e.message ? e.message : String(e),
    };
  }
}

/* ---------- Dates ---------- */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

function unitFor(sec: number) {
  const a = Math.abs(sec);
  for (const [u, s] of UNITS)
    if (a >= s * 0.95) return { u, n: Math.round(a / s) };
  return { u: "second" as const, n: 0 };
}

/** "3 days ago" / "in 2 hours" */
function relative(lang: Locale, sec: number) {
  const { u, n } = unitFor(sec);
  return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(
    sec < 0 ? -n : n,
    u,
  );
}

/** "2 hours" */
function duration(lang: Locale, sec: number) {
  const { u, n } = unitFor(sec);
  return new Intl.NumberFormat(lang, {
    style: "unit",
    unit: u,
    unitDisplay: "long",
  }).format(n);
}

const CLAIMS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued",
  jti: "Token ID",
};

const SAMPLE_SECRET = "kmra-sample-secret";

async function sampleToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) =>
    toBase64(utf8(JSON.stringify(o)), { urlSafe: true, pad: false });
  const input = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({
    sub: "1234567890",
    name: "Ada Lovelace",
    role: "admin",
    iat: now,
    exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(SAMPLE_SECRET) as Uint8Array<ArrayBuffer>,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    utf8(input) as Uint8Array<ArrayBuffer>,
  );
  return `${input}.${toBase64(new Uint8Array(sig), { urlSafe: true, pad: false })}`;
}

export default function JwtDecoder(_: ToolProps) {
  const T = useT();
  const lang = useLang();
  const [input, setInput] = useInput("jwt-decoder");
  const [key, setKey] = useState("");
  const [secretB64, setSecretB64] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 15000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, ...parse(input) };
    } catch (e) {
      if (!(e instanceof JwtError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input]);

  const parsed = result?.ok ? result : null;
  const alg = parsed ? String(parsed.header.alg ?? "") : "";
  const params = algParams(alg);
  const hmac = params?.name === "HMAC";

  useEffect(() => {
    setCheck(null);
    if (!parsed || !params || !key.trim()) return;
    let live = true;
    void verify(parsed, alg, key, secretB64).then((c) => live && setCheck(c));
    return () => {
      live = false;
    };
  }, [parsed, alg, key, secretB64]); // eslint-disable-line react-hooks/exhaustive-deps

  const error: PaneError | null =
    result && !result.ok
      ? {
          message: T(result.error.message),
          ...(result.error.index !== undefined
            ? lineCol(input, result.error.index)
            : {}),
        }
      : null;

  const payload = parsed?.payload ?? null;
  const num = (k: string) =>
    typeof payload?.[k] === "number" ? (payload[k] as number) : null;
  const exp = num("exp");
  const nbf = num("nbf");
  const expired = exp !== null && exp < now;
  const early = nbf !== null && nbf > now;

  function when(k: string, v: number) {
    const d = new Date(v * 1000);
    const diff = v - now;
    let note = relative(lang, diff);
    if (k === "exp")
      note =
        diff < 0
          ? T("Expired {when}", { when: relative(lang, diff) })
          : T("Valid for {d}", { d: duration(lang, diff) });
    if (k === "nbf" && diff > 0)
      note = T("Not valid yet, starts {when}", { when: relative(lang, diff) });
    return (
      <>
        <span>
          {d.toLocaleString(lang, { dateStyle: "medium", timeStyle: "medium" })}
        </span>
        <span
          className={
            (k === "exp" && diff < 0) || (k === "nbf" && diff > 0)
              ? "bad"
              : k === "exp"
                ? "ok"
                : "muted"
          }
        >
          {note}
        </span>
      </>
    );
  }

  const headerText = parsed ? JSON.stringify(parsed.header, null, 2) : "";
  const payloadText = parsed
    ? payload
      ? JSON.stringify(payload, null, 2)
      : parsed.payloadText
    : "";

  return (
    <Workspace
      cols={3}
      bar={
        <>
          <span className="bar-item bar-label">
            {T(
              "Paste a token to read it. Signatures are checked on your device.",
            )}
          </span>
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() =>
                void sampleToken().then((t) => {
                  setInput(t);
                  setKey(SAMPLE_SECRET);
                  setSecretB64(false);
                })
              }
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>{T("Paste a JWT to start.")}</span>
        ) : !result.ok ? (
          <span className="bad">{T("Not a valid JWT")}</span>
        ) : (
          <>
            <span>
              {alg || "?"}
              {parsed!.header.typ ? ` · ${String(parsed!.header.typ)}` : ""}
            </span>
            {exp !== null && (
              <span className={expired ? "bad" : "ok"}>
                {expired
                  ? T("Expired {when}", { when: relative(lang, exp - now) })
                  : T("Valid for {d}", { d: duration(lang, exp - now) })}
              </span>
            )}
            {early && <span className="bad">{T("Not valid yet")}</span>}
            {check?.state === "ok" && (
              <span className="ok">{T("Signature verified")}</span>
            )}
            {check?.state === "bad" && (
              <span className="bad">{T("Signature doesn't match")}</span>
            )}
          </>
        )
      }
    >
      <Pane
        label={T("Token")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste a JWT (eyJ…)")}
        error={error}
        wrap
      />
      <Pane label={T("Header")} value={headerText} readOnly>
        {parsed ? (
          <div className="jwt-view">
            <pre className="jwt-json">{headerText}</pre>
            <div className="jwt-sec">
              <h3>{T("Signature")}</h3>
              {alg === "none" || !alg ? (
                <p className="bad">
                  {T(
                    "This token isn't signed, so anyone could have changed it.",
                  )}
                </p>
              ) : !params ? (
                <p className="muted">
                  {T("Checking this kind of signature isn't supported here.")}{" "}
                  <code>{alg}</code>
                </p>
              ) : (
                <>
                  {hmac ? (
                    <>
                      <label className="jwt-field">
                        <span>{T("Secret")}</span>
                        <input
                          type="text"
                          value={key}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder={T(
                            "The secret the token was signed with",
                          )}
                          onChange={(e) => setKey(e.target.value)}
                        />
                      </label>
                      <BarCheck
                        label={T("Secret is Base64")}
                        on={secretB64}
                        onChange={setSecretB64}
                      />
                    </>
                  ) : (
                    <>
                      <p className="muted">
                        {T(
                          "This token is signed with a private key. Paste the matching public key (PEM, certificate or JWK) to check the signature.",
                        )}
                      </p>
                      <label className="jwt-field">
                        <span>{T("Public key")}</span>
                        <textarea
                          rows={5}
                          value={key}
                          spellCheck={false}
                          placeholder="-----BEGIN PUBLIC KEY-----"
                          onChange={(e) => setKey(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  {check?.state === "ok" && (
                    <p className="jwt-badge ok">{T("Signature verified")}</p>
                  )}
                  {check?.state === "bad" && (
                    <p className="jwt-badge bad">
                      {hmac
                        ? T(
                            "Signature doesn't match. The secret is wrong or the token was changed.",
                          )
                        : T(
                            "Signature doesn't match. The key is wrong or the token was changed.",
                          )}
                    </p>
                  )}
                  {check?.state === "error" && (
                    <p className="jwt-badge bad">
                      {T("Couldn't use this key.")} {T(check.message)}
                    </p>
                  )}
                  {!key.trim() && (
                    <p className="muted">
                      {hmac
                        ? T("Enter the secret to check the signature.")
                        : T(
                            "Without the public key the signature can't be checked.",
                          )}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : undefined}
      </Pane>
      <Pane label={T("Payload")} value={payloadText} readOnly>
        {parsed ? (
          <div className="jwt-view">
            <pre className="jwt-json">{payloadText}</pre>
            {payload && Object.keys(CLAIMS).some((k) => k in payload) && (
              <dl className="jwt-claims">
                {Object.entries(CLAIMS)
                  .filter(([k]) => k in payload)
                  .map(([k, label]) => (
                    <div key={k}>
                      <dt>
                        {T(label)} <code>{k}</code>
                      </dt>
                      <dd>
                        {typeof payload[k] === "number" &&
                        ["exp", "nbf", "iat"].includes(k)
                          ? when(k, payload[k] as number)
                          : Array.isArray(payload[k])
                            ? (payload[k] as unknown[]).join(", ")
                            : String(payload[k])}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        ) : undefined}
      </Pane>
    </Workspace>
  );
}
