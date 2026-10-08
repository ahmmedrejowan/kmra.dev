/**
 * The photo engine's model files (PaddleOCR PP-OCRv5 mobile, ONNX, Apache-2.0), served from this
 * site's /models folder. Sources, licences and checksums: apps/ocrtool/public/models/README.md.
 * Shared by photo.ts (main thread) and photo.worker.ts.
 */

/** Recognition models, one per script family */
export type RecId = "latin" | "ch" | "cyrillic";

export interface ModelFile {
  file: string;
  bytes: number;
}

/** Text detection (finds the lines) and the 0°/180° line classifier */
export const DET: ModelFile = { file: "ppocrv5-det.onnx", bytes: 4_819_576 };
export const CLS: ModelFile = { file: "ppocr-cls.onnx", bytes: 585_532 };

/** Recognition model + its character list (`<name>.txt`, one character per line) */
export const REC: Record<RecId, ModelFile & { dict: string }> = {
  latin: {
    file: "ppocrv5-rec-latin.onnx",
    dict: "ppocrv5-rec-latin.txt",
    bytes: 7_904_513,
  },
  ch: {
    file: "ppocrv5-rec-ch.onnx",
    dict: "ppocrv5-rec-ch.txt",
    bytes: 16_631_306,
  },
  cyrillic: {
    file: "ppocrv5-rec-cyrillic.onnx",
    dict: "ppocrv5-rec-cyrillic.txt",
    bytes: 8_074_092,
  },
};

/**
 * Tesseract code → recognition model. Only languages whose letters are all in the model's
 * character list are listed (e.g. Vietnamese, Romanian and Latvian are missing letters in the
 * Latin model, so they stay with the document engine).
 */
export const LANG_MODEL: Record<string, RecId> = {
  // Latin script (English included: this model read English screenshots better than the
  // English-only model in our tests)
  eng: "latin",
  fra: "latin",
  deu: "latin",
  spa: "latin",
  por: "latin",
  ita: "latin",
  nld: "latin",
  pol: "latin",
  tur: "latin",
  ces: "latin",
  slk: "latin",
  slv: "latin",
  hrv: "latin",
  hun: "latin",
  dan: "latin",
  nor: "latin",
  swe: "latin",
  fin: "latin",
  isl: "latin",
  est: "latin",
  lit: "latin",
  cat: "latin",
  glg: "latin",
  eus: "latin",
  ind: "latin",
  msa: "latin",
  tgl: "latin",
  afr: "latin",
  swa: "latin",
  sqi: "latin",
  lat: "latin",
  // Chinese (simplified and traditional) and Japanese: one model, which also reads English
  chi_sim: "ch",
  chi_tra: "ch",
  jpn: "ch",
  // Cyrillic script (the model also reads English)
  rus: "cyrillic",
  ukr: "cyrillic",
  bel: "cyrillic",
  bul: "cyrillic",
  srp: "cyrillic",
  mkd: "cyrillic",
  kaz: "cyrillic",
  kir: "cyrillic",
  mon: "cyrillic",
  tgk: "cyrillic",
  tat: "cyrillic",
  bak: "cyrillic",
};

/**
 * Recognition models for a language choice. The Chinese and Cyrillic models read English too,
 * so English alone doesn't add the Latin model next to them.
 */
export function modelsFor(langs: string[]): { recs: RecId[]; used: string[] } {
  const used = langs.filter((l) => l in LANG_MODEL);
  const set = new Set(
    used.filter((l) => l !== "eng").map((l) => LANG_MODEL[l]!),
  );
  if (used.includes("eng") && !set.size) set.add("latin");
  return { recs: [...set], used };
}

/** Bytes to download for a language choice (before anything is cached) */
export function bytesFor(langs: string[]): number {
  const { recs } = modelsFor(langs);
  return recs.reduce((n, r) => n + REC[r].bytes, DET.bytes + CLS.bytes);
}
