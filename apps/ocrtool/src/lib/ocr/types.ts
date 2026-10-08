/**
 * The contract between the OCR tools and the two engines. Tools only talk to `recognize()` in
 * ./index.ts; each engine runs in its own Web Worker and returns this shape.
 *
 *   document: Tesseract (tesseract.js) — scans and documents, 43 languages (best_int models).
 *   photo:    PaddleOCR (ONNX on onnxruntime-web) — photos, screenshots, uneven text.
 */

export type EngineId = "document" | "photo";

/** Axis-aligned box in source-image pixels */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Word {
  text: string;
  box: Box;
  /** 0–100 */
  confidence: number;
}

export interface Line {
  text: string;
  box: Box;
  /** 0–100 */
  confidence: number;
  words: Word[];
}

export interface OcrResult {
  engine: EngineId;
  /** Tesseract language codes actually used, e.g. ["eng"] or ["chi_sim", "eng"] */
  langs: string[];
  /** Plain text, lines joined with \n and blocks/paragraphs separated by a blank line */
  text: string;
  lines: Line[];
  /** Mean line confidence, 0–100 */
  confidence: number;
  /** Size of the image that was read (the boxes are in this space) */
  width: number;
  height: number;
  ms: number;
}

export interface RecognizeOptions {
  engine: EngineId;
  /** Tesseract codes ("eng", "chi_sim", "jpn", "ara", …); the photo engine maps them to its models */
  langs: string[];
  /** Progress 0–1 with a short English status ("Loading engine", "Reading text") */
  onProgress?: (p: number, status: string) => void;
  signal?: AbortSignal;
}

/** One language a user can pick */
export interface Language {
  /** Tesseract code */
  code: string;
  /** English name */
  name: string;
  /** Native name, shown next to the English one */
  native: string;
  /** Right-to-left script */
  rtl?: boolean;
  /** Supported by the photo engine too */
  photo?: boolean;
}
