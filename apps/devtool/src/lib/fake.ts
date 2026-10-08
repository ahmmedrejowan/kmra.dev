/**
 * Fake test data from small built-in lists. Everything is obviously made up: emails and URLs
 * use the reserved example.com/.org/.net domains, phone numbers the fictional 555-01xx range,
 * IP addresses the documentation ranges (192.0.2.0/24 and friends, 2001:db8::/32).
 * A seeded generator (mulberry32) makes the output repeatable.
 */

export type FieldKind =
  | "id"
  | "uuid"
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "username"
  | "phone"
  | "company"
  | "job_title"
  | "street"
  | "city"
  | "country"
  | "zip"
  | "lat"
  | "lng"
  | "date"
  | "number"
  | "active"
  | "url"
  | "ipv4"
  | "ipv6"
  | "color"
  | "sentence"
  | "price";

export const FIELDS: {
  kind: FieldKind;
  label: string;
  type: "number" | "string" | "boolean";
}[] = [
  { kind: "id", label: "ID (1, 2, 3…)", type: "number" },
  { kind: "uuid", label: "UUID", type: "string" },
  { kind: "first_name", label: "First name", type: "string" },
  { kind: "last_name", label: "Last name", type: "string" },
  { kind: "full_name", label: "Full name", type: "string" },
  { kind: "email", label: "Email", type: "string" },
  { kind: "username", label: "Username", type: "string" },
  { kind: "phone", label: "Phone", type: "string" },
  { kind: "company", label: "Company", type: "string" },
  { kind: "job_title", label: "Job title", type: "string" },
  { kind: "street", label: "Street", type: "string" },
  { kind: "city", label: "City", type: "string" },
  { kind: "country", label: "Country", type: "string" },
  { kind: "zip", label: "ZIP code", type: "string" },
  { kind: "lat", label: "Latitude", type: "number" },
  { kind: "lng", label: "Longitude", type: "number" },
  { kind: "date", label: "Date", type: "string" },
  { kind: "number", label: "Number", type: "number" },
  { kind: "active", label: "Yes or no", type: "boolean" },
  { kind: "url", label: "URL", type: "string" },
  { kind: "ipv4", label: "IPv4 address", type: "string" },
  { kind: "ipv6", label: "IPv6 address", type: "string" },
  { kind: "color", label: "Color", type: "string" },
  { kind: "sentence", label: "Sentence", type: "string" },
  { kind: "price", label: "Price", type: "number" },
];

const FIRST = (
  "Ada Alan Amara Ana Arjun Aya Ben Bilal Carla Chen Chloe Dana Diego Elena Emil Farah Felix " +
  "Grace Hana Hugo Imani Ivan Jade Jonas Kai Kenji Lara Leo Lina Lucas Maya Mateo Mei Mila " +
  "Nadia Noah Nora Omar Oscar Priya Rafael Rina Rosa Sami Sara Sofia Tariq Theo Uma Vera " +
  "Yusuf Zara Zoe"
).split(" ");
const LAST = (
  "Adams Ahmed Alvarez Becker Bianchi Brooks Carter Chen Costa Dubois Evans Fischer Garcia " +
  "Gupta Hansen Hughes Ito Jensen Kim Kowalski Larsen Lee Lopez Martin Meyer Moreau Nakamura " +
  "Nguyen Novak Okafor Olsen Park Patel Perez Petrov Quinn Rahman Rossi Santos Schmidt Silva " +
  "Singh Sato Tanaka Turner Varga Walker Weber Wright Young Zhang"
).split(" ");
const CO_A =
  "Blue Bright Clear Cloud Copper Delta Green Harbor Iron Lumen North Oak Pixel Quiet Silver Summit Swift True".split(
    " ",
  );
const CO_B =
  "Analytics Bakery Labs Logistics Media Motors Networks Robotics Studio Systems Textiles Works".split(
    " ",
  );
const CO_C = ["Inc.", "Ltd.", "LLC", "Co.", "GmbH", ""];
const JOBS = (
  "Software engineer|Product manager|Data analyst|UX designer|Support specialist|" +
  "Marketing lead|Accountant|Sales representative|QA engineer|DevOps engineer|" +
  "Project coordinator|Technical writer|HR manager|Office manager|Research scientist|" +
  "Frontend developer|Backend developer|Customer success manager"
).split("|");
const STREETS =
  "Maple Oak Pine Cedar Elm Willow Birch Lake Hill River Park Church Mill Station Garden Sunset".split(
    " ",
  );
const STREET_TYPES = [
  "Street",
  "Avenue",
  "Road",
  "Lane",
  "Drive",
  "Way",
  "Court",
];
const CITIES: [string, string][] = [
  ["Springfield", "United States"],
  ["Riverton", "United States"],
  ["Lakeside", "Canada"],
  ["Maplewood", "Canada"],
  ["Ashford", "United Kingdom"],
  ["Kingsbridge", "United Kingdom"],
  ["Neustadt", "Germany"],
  ["Rosenheim", "Germany"],
  ["Villeneuve", "France"],
  ["Montclair", "France"],
  ["San Lorenzo", "Spain"],
  ["Villanueva", "Spain"],
  ["Porto Alegre", "Brazil"],
  ["Nova Vila", "Brazil"],
  ["Midori", "Japan"],
  ["Haruno", "Japan"],
  ["Rampur", "India"],
  ["Chandpur", "Bangladesh"],
  ["Westport", "Ireland"],
  ["Bergvik", "Norway"],
  ["Lindholm", "Sweden"],
  ["Newhaven", "Australia"],
  ["Kowhai", "New Zealand"],
  ["Cape Point", "South Africa"],
];
const LOREM = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut " +
  "labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco"
).split(" ");
const DOMAINS = ["example.com", "example.org", "example.net"];

/** A repeatable random source from a text seed */
export function rng(seed: string): () => number {
  // xmur3 string hash → mulberry32
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FakeOptions {
  /** Days back (past) or ahead (future) for dates */
  dates: "past" | "future";
  min: number;
  max: number;
  /** Today, for date ranges (passed in so seeded output doesn't drift) */
  today: Date;
}

export type Value = string | number | boolean;
export type FakeRow = Record<string, Value>;

export function makeRows(
  kinds: FieldKind[],
  count: number,
  seed: string,
  o: FakeOptions,
): FakeRow[] {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)]!;
  const hex = (n: number) =>
    Array.from({ length: n }, () => "0123456789abcdef"[int(0, 15)]).join("");
  const rows: FakeRow[] = [];
  for (let n = 0; n < count; n++) {
    // Draw the person and place first so name, email and username agree
    const first = pick(FIRST);
    const last = pick(LAST);
    const [city, country] = pick(CITIES);
    const user =
      `${first}.${last}`.toLowerCase() + (r() < 0.5 ? "" : int(1, 99));
    const row: FakeRow = {};
    for (const k of kinds) {
      switch (k) {
        case "id":
          row[k] = n + 1;
          break;
        case "uuid": {
          const h = hex(32).split("");
          h[12] = "4";
          h[16] = "89ab"[int(0, 3)]!;
          const s = h.join("");
          row[k] =
            `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
          break;
        }
        case "first_name":
          row[k] = first;
          break;
        case "last_name":
          row[k] = last;
          break;
        case "full_name":
          row[k] = `${first} ${last}`;
          break;
        case "email":
          row[k] = `${user}@${pick(DOMAINS)}`;
          break;
        case "username":
          row[k] = user.replace(".", "_");
          break;
        case "phone":
          row[k] = `+1-555-01${String(int(0, 99)).padStart(2, "0")}`;
          break;
        case "company": {
          const s = pick(CO_C);
          row[k] = `${pick(CO_A)} ${pick(CO_B)}${s ? " " + s : ""}`;
          break;
        }
        case "job_title":
          row[k] = pick(JOBS);
          break;
        case "street":
          row[k] = `${int(1, 999)} ${pick(STREETS)} ${pick(STREET_TYPES)}`;
          break;
        case "city":
          row[k] = city;
          break;
        case "country":
          row[k] = country;
          break;
        case "zip":
          row[k] = String(int(10000, 99999));
          break;
        case "lat":
          row[k] = Math.round((r() * 180 - 90) * 1e6) / 1e6;
          break;
        case "lng":
          row[k] = Math.round((r() * 360 - 180) * 1e6) / 1e6;
          break;
        case "date": {
          const days = int(1, 730) * (o.dates === "past" ? -1 : 1);
          const d = new Date(o.today.getTime() + days * 86400000);
          row[k] = d.toISOString().slice(0, 10);
          break;
        }
        case "number":
          row[k] = int(Math.min(o.min, o.max), Math.max(o.min, o.max));
          break;
        case "active":
          row[k] = r() < 0.5;
          break;
        case "url":
          row[k] = `https://www.${pick(DOMAINS)}/${user.replace(".", "-")}`;
          break;
        case "ipv4": {
          const net = pick(["192.0.2", "198.51.100", "203.0.113"]);
          row[k] = `${net}.${int(1, 254)}`;
          break;
        }
        case "ipv6":
          row[k] =
            `2001:db8:${hex(4).replace(/^0+(?=.)/, "")}:${hex(4).replace(/^0+(?=.)/, "")}::${hex(4).replace(/^0+(?=.)/, "")}`;
          break;
        case "color":
          row[k] = "#" + hex(6);
          break;
        case "sentence": {
          const w = Array.from({ length: int(5, 10) }, () => pick(LOREM)).join(
            " ",
          );
          row[k] = w[0]!.toUpperCase() + w.slice(1) + ".";
          break;
        }
        case "price":
          row[k] = int(100, 99999) / 100;
          break;
      }
    }
    rows.push(row);
  }
  return rows;
}

export type Format = "json" | "csv" | "sql" | "ts";

const csvCell = (v: Value) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sqlValue = (v: Value) =>
  typeof v === "number"
    ? String(v)
    : typeof v === "boolean"
      ? v
        ? "TRUE"
        : "FALSE"
      : `'${v.replace(/'/g, "''")}'`;

/** A safe SQL identifier: letters, digits and underscores, not starting with a digit */
export function sqlName(s: string): string {
  const v = s
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^(\d)/, "_$1");
  return v || "test_data";
}

export function formatRows(
  rows: FakeRow[],
  kinds: FieldKind[],
  format: Format,
  table: string,
): string {
  if (!kinds.length) return "";
  switch (format) {
    case "json":
      return JSON.stringify(rows, null, 2);
    case "csv":
      return [
        kinds.join(","),
        ...rows.map((r) => kinds.map((k) => csvCell(r[k]!)).join(",")),
      ].join("\n");
    case "sql": {
      const t = sqlName(table);
      const cols = kinds.join(", ");
      return rows
        .map(
          (r) =>
            `INSERT INTO ${t} (${cols}) VALUES (${kinds.map((k) => sqlValue(r[k]!)).join(", ")});`,
        )
        .join("\n");
    }
    case "ts": {
      const types = new Map(FIELDS.map((f) => [f.kind, f.type]));
      const name = pascal(sqlName(table));
      const iface = `export interface ${name} {\n${kinds.map((k) => `  ${k}: ${types.get(k)};`).join("\n")}\n}`;
      const body = rows
        .map(
          (r) =>
            `  { ${kinds.map((k) => `${k}: ${JSON.stringify(r[k])}`).join(", ")} },`,
        )
        .join("\n");
      return `${iface}\n\nexport const rows: ${name}[] = [\n${body}\n];\n`;
    }
  }
}

function pascal(s: string): string {
  const p = s
    .split(/_+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");
  // A table like "users" gives a row type "User"
  const one = p.endsWith("ies") ? p.slice(0, -3) + "y" : p.replace(/s$/, "");
  return /^[A-Za-z]/.test(one) ? one : "Row";
}
