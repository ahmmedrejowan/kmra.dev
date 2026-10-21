/**
 * IPTC captions and credits, inside a JPEG's APP13 "Photoshop 3.0" block (resource 0x0404).
 * Read the records, drop datasets, write the block back with only the IPTC resource (Photoshop's
 * other resources there, such as its own preview copies, are metadata too and go).
 */

export interface IptcRecord {
  record: number;
  dataset: number;
  data: Uint8Array;
}

const PS = "Photoshop 3.0\0";

const text = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, Math.min(b.length, at + n)));

/** Records from an APP13 payload (the bytes after the marker and length) */
export function readIptc(payload: Uint8Array): IptcRecord[] {
  if (text(payload, 0, PS.length) !== PS) return [];
  const v = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let pos = PS.length;
  while (pos + 12 <= payload.length) {
    if (text(payload, pos, 4) !== "8BIM") break;
    const id = v.getUint16(pos + 4);
    const nameLen = payload[pos + 6]!;
    let p = pos + 6 + 1 + nameLen;
    if ((1 + nameLen) % 2) p++;
    const size = v.getUint32(p);
    const start = p + 4;
    if (id === 0x0404) return records(payload.subarray(start, start + size));
    pos = start + size + (size & 1);
  }
  return [];
}

function records(b: Uint8Array): IptcRecord[] {
  const out: IptcRecord[] = [];
  let pos = 0;
  while (pos + 5 <= b.length && b[pos] === 0x1c) {
    const record = b[pos + 1]!;
    const dataset = b[pos + 2]!;
    let len = (b[pos + 3]! << 8) | b[pos + 4]!;
    let start = pos + 5;
    if (len & 0x8000) {
      // Extended length: the next (len & 0x7fff) bytes hold it
      const n = len & 0x7fff;
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + b[start + i]!;
      start += n;
    }
    out.push({ record, dataset, data: b.slice(start, start + len) });
    pos = start + len;
  }
  return out;
}

/** An APP13 payload holding just these records */
export function writeIptc(recs: IptcRecord[]): Uint8Array<ArrayBuffer> {
  const body: number[] = [];
  for (const r of recs) {
    body.push(0x1c, r.record, r.dataset);
    if (r.data.length < 0x8000) body.push(r.data.length >> 8, r.data.length & 0xff);
    else body.push(0x80, 4, ...[24, 16, 8, 0].map((s) => (r.data.length >>> s) & 0xff));
    body.push(...r.data);
  }
  const head = [...PS].map((c) => c.charCodeAt(0));
  const res = [...[..."8BIM"].map((c) => c.charCodeAt(0)), 0x04, 0x04, 0, 0, ...[24, 16, 8, 0].map((s) => (body.length >>> s) & 0xff)];
  const out = new Uint8Array(head.length + res.length + body.length + (body.length & 1));
  out.set(head);
  out.set(res, head.length);
  out.set(body, head.length + res.length);
  return out;
}

/** Common IPTC datasets (record 2) by number */
export const IPTC_NAMES: Record<number, string> = {
  5: "Title",
  10: "Urgency",
  15: "Category",
  20: "Supplemental categories",
  25: "Keywords",
  40: "Special instructions",
  55: "Date created",
  60: "Time created",
  62: "Digital creation date",
  63: "Digital creation time",
  65: "Originating program",
  70: "Program version",
  80: "By-line (author)",
  85: "By-line title",
  90: "City",
  92: "Sublocation",
  95: "Province or state",
  100: "Country code",
  101: "Country",
  103: "Original transmission reference",
  105: "Headline",
  110: "Credit",
  115: "Source",
  116: "Copyright notice",
  118: "Contact",
  120: "Caption",
  122: "Caption writer",
};
