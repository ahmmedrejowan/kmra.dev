/**
 * A tiny TrueType font with no visible glyphs, for the invisible text layer of searchable PDFs
 * (the same idea as Tesseract's and OCRmyPDF's "GlyphLessFont").
 *
 * In the PDF it's a Type 0 font with Identity-H encoding where every 2-byte code is a UTF-16 code
 * unit, every code maps to the one empty glyph, every glyph is half an em wide, and the ToUnicode
 * map turns the codes straight back into text. So any script (Latin, Cyrillic, CJK, Arabic,
 * Indic…) can be searched and copied without embedding a real font for it, and the file stays
 * small. The text is drawn in render mode 3 (invisible) anyway.
 */

/** Glyph advance in font units (units per em = 1000) */
export const GLYPH_WIDTH = 500;
export const ASCENT = 800;
export const DESCENT = -200;

function table(size: number) {
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  return { buf, dv };
}

function checksum(b: Uint8Array): number {
  let sum = 0;
  const padded = new Uint8Array((b.length + 3) & ~3);
  padded.set(b);
  const dv = new DataView(padded.buffer);
  for (let i = 0; i < padded.length; i += 4)
    sum = (sum + dv.getUint32(i)) >>> 0;
  return sum;
}

function utf16be(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    out[i * 2] = s.charCodeAt(i) >> 8;
    out[i * 2 + 1] = s.charCodeAt(i) & 0xff;
  }
  return out;
}

/** The font file (FontFile2): two empty glyphs (.notdef and the one every code uses). */
export function glyphlessFont(): Uint8Array {
  const NAME = "GlyphLessFont";
  const tables: [string, Uint8Array][] = [];

  // OS/2 version 1
  {
    const { buf, dv } = table(86);
    dv.setUint16(0, 1); // version
    dv.setInt16(2, GLYPH_WIDTH); // xAvgCharWidth
    dv.setUint16(4, 400); // weight
    dv.setUint16(6, 5); // width class
    dv.setUint16(8, 0); // fsType: installable (embedding allowed)
    dv.setInt16(26, 50); // strikeout size
    dv.setInt16(28, 250); // strikeout position
    dv.setUint16(62, 0x40); // fsSelection: regular
    dv.setUint16(64, 0x20); // first char
    dv.setUint16(66, 0xffff); // last char
    dv.setInt16(68, ASCENT);
    dv.setInt16(70, DESCENT);
    dv.setInt16(72, 0); // line gap
    dv.setUint16(74, ASCENT); // win ascent
    dv.setUint16(76, -DESCENT); // win descent
    dv.setUint32(78, 1); // code page: Latin 1
    tables.push(["OS/2", buf]);
  }
  // cmap: format 4 with only the closing segment (codes are mapped by the PDF, not the font)
  {
    const { buf, dv } = table(12 + 24);
    dv.setUint16(0, 0);
    dv.setUint16(2, 1);
    dv.setUint16(4, 3); // Windows
    dv.setUint16(6, 1); // Unicode BMP
    dv.setUint32(8, 12);
    const o = 12;
    dv.setUint16(o, 4);
    dv.setUint16(o + 2, 24);
    dv.setUint16(o + 4, 0);
    dv.setUint16(o + 6, 2); // segCountX2
    dv.setUint16(o + 8, 2); // searchRange
    dv.setUint16(o + 10, 0); // entrySelector
    dv.setUint16(o + 12, 0); // rangeShift
    dv.setUint16(o + 14, 0xffff); // endCode
    dv.setUint16(o + 16, 0); // pad
    dv.setUint16(o + 18, 0xffff); // startCode
    dv.setInt16(o + 20, 1); // idDelta
    dv.setUint16(o + 22, 0); // idRangeOffset
    tables.push(["cmap", buf]);
  }
  // glyf: both glyphs are empty (a few zero bytes so the table isn't zero length)
  tables.push(["glyf", new Uint8Array(4)]);
  // head
  {
    const { buf, dv } = table(54);
    dv.setUint32(0, 0x00010000);
    dv.setUint32(4, 0x00010000);
    dv.setUint32(8, 0); // checkSumAdjustment, filled in below
    dv.setUint32(12, 0x5f0f3cf5);
    dv.setUint16(16, 0x000b);
    dv.setUint16(18, 1000); // units per em
    dv.setInt16(36, 0); // xMin
    dv.setInt16(38, DESCENT); // yMin
    dv.setInt16(40, GLYPH_WIDTH); // xMax
    dv.setInt16(42, ASCENT); // yMax
    dv.setUint16(44, 0); // macStyle
    dv.setUint16(46, 8); // lowestRecPPEM
    dv.setInt16(48, 2); // fontDirectionHint
    dv.setInt16(50, 0); // indexToLocFormat: short
    dv.setInt16(52, 0);
    tables.push(["head", buf]);
  }
  // hhea
  {
    const { buf, dv } = table(36);
    dv.setUint32(0, 0x00010000);
    dv.setInt16(4, ASCENT);
    dv.setInt16(6, DESCENT);
    dv.setInt16(8, 0);
    dv.setUint16(10, GLYPH_WIDTH);
    dv.setInt16(16, GLYPH_WIDTH); // xMaxExtent
    dv.setInt16(18, 1); // caret slope rise
    dv.setUint16(34, 2); // numberOfHMetrics
    tables.push(["hhea", buf]);
  }
  // hmtx
  {
    const { buf, dv } = table(8);
    dv.setUint16(0, GLYPH_WIDTH);
    dv.setUint16(4, GLYPH_WIDTH);
    tables.push(["hmtx", buf]);
  }
  // loca (short): three offsets, all 0
  tables.push(["loca", new Uint8Array(6)]);
  // maxp 1.0
  {
    const { buf, dv } = table(32);
    dv.setUint32(0, 0x00010000);
    dv.setUint16(4, 2); // numGlyphs
    dv.setUint16(14, 2); // maxZones
    tables.push(["maxp", buf]);
  }
  // name
  {
    const records: [number, string][] = [
      [1, NAME],
      [2, "Regular"],
      [3, NAME],
      [4, NAME],
      [5, "Version 1.0"],
      [6, NAME],
    ];
    const strings = records.map(([, s]) => utf16be(s));
    const head = 6 + records.length * 12;
    const size = head + strings.reduce((a, s) => a + s.length, 0);
    const { buf, dv } = table(size);
    dv.setUint16(0, 0);
    dv.setUint16(2, records.length);
    dv.setUint16(4, head);
    let off = 0;
    records.forEach(([id], i) => {
      const r = 6 + i * 12;
      dv.setUint16(r, 3);
      dv.setUint16(r + 2, 1);
      dv.setUint16(r + 4, 0x409);
      dv.setUint16(r + 6, id);
      dv.setUint16(r + 8, strings[i]!.length);
      dv.setUint16(r + 10, off);
      buf.set(strings[i]!, head + off);
      off += strings[i]!.length;
    });
    tables.push(["name", buf]);
  }
  // post 3.0 (no glyph names)
  {
    const { buf, dv } = table(32);
    dv.setUint32(0, 0x00030000);
    dv.setInt16(8, -100);
    dv.setInt16(10, 50);
    tables.push(["post", buf]);
  }

  tables.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const n = tables.length;
  const dirSize = 12 + n * 16;
  let total = dirSize;
  for (const [, b] of tables) total += (b.length + 3) & ~3;
  const font = new Uint8Array(total);
  const dv = new DataView(font.buffer);
  dv.setUint32(0, 0x00010000);
  dv.setUint16(4, n);
  const pow = 2 ** Math.floor(Math.log2(n));
  dv.setUint16(6, pow * 16);
  dv.setUint16(8, Math.log2(pow));
  dv.setUint16(10, n * 16 - pow * 16);
  let off = dirSize;
  let headAt = 0;
  tables.forEach(([tag, b], i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) font[r + k] = tag.charCodeAt(k);
    dv.setUint32(r + 4, checksum(b));
    dv.setUint32(r + 8, off);
    dv.setUint32(r + 12, b.length);
    font.set(b, off);
    if (tag === "head") headAt = off;
    off += (b.length + 3) & ~3;
  });
  dv.setUint32(headAt + 8, (0xb1b0afba - checksum(font)) >>> 0);
  return font;
}

/** ToUnicode CMap: each 2-byte code is the UTF-16 code unit itself. */
export function identityToUnicode(): string {
  const ranges: string[] = [];
  for (let hi = 0; hi < 256; hi++) {
    const h = hi.toString(16).padStart(2, "0").toUpperCase();
    ranges.push(`<${h}00> <${h}FF> <${h}00>`);
  }
  const blocks: string[] = [];
  for (let i = 0; i < ranges.length; i += 100) {
    const part = ranges.slice(i, i + 100);
    blocks.push(`${part.length} beginbfrange\n${part.join("\n")}\nendbfrange`);
  }
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${blocks.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`;
}

/** Text as the font's codes: UTF-16BE hex */
export function encodeHex(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++)
    out += s.charCodeAt(i).toString(16).padStart(4, "0");
  return out.toUpperCase();
}
