import type { Language } from "./types";
import { PHOTO_LANGS } from "./photo";

/**
 * The languages the OCR tools offer. Codes are Tesseract's. The document engine reads every one
 * of them; `photo` marks the ones the photo engine supports too. Each language's data is served
 * from this site (/tesseract/lang/<code>.traineddata.gz, committed in public/tesseract/lang; originally from the @tesseract.js-data
 * packages at build) and downloaded the first time it's used.
 *
 * `bytes` is the download size (gzipped "best_int" LSTM model), shown before the first download.
 * Keep this list in sync with the files in public/tesseract/lang.
 */
const LIST: [
  code: string,
  name: string,
  native: string,
  bytes: number,
  rtl?: true,
][] = [
  ["eng", "English", "English", 2_952_873],
  ["chi_sim", "Chinese (Simplified)", "简体中文", 1_718_768],
  ["chi_tra", "Chinese (Traditional)", "繁體中文", 1_656_239],
  ["jpn", "Japanese", "日本語", 2_030_256],
  ["jpn_vert", "Japanese (vertical)", "日本語（縦書き）", 2_022_755],
  ["kor", "Korean", "한국어", 1_572_336],
  ["ara", "Arabic", "العربية", 1_661_906, true],
  ["hin", "Hindi", "हिन्दी", 1_389_692],
  ["ben", "Bangla", "বাংলা", 1_373_429],
  ["rus", "Russian", "Русский", 2_679_598],
  ["ukr", "Ukrainian", "Українська", 2_114_206],
  ["bul", "Bulgarian", "Български", 1_411_343],
  ["spa", "Spanish", "Español", 2_100_190],
  ["por", "Portuguese", "Português", 1_392_239],
  ["fra", "French", "Français", 707_406],
  ["deu", "German", "Deutsch", 1_333_102],
  ["ita", "Italian", "Italiano", 1_660_998],
  ["nld", "Dutch", "Nederlands", 3_005_696],
  ["pol", "Polish", "Polski", 2_642_356],
  ["tur", "Turkish", "Türkçe", 2_141_291],
  ["vie", "Vietnamese", "Tiếng Việt", 1_423_003],
  ["ind", "Indonesian", "Bahasa Indonesia", 1_194_182],
  ["msa", "Malay", "Bahasa Melayu", 1_177_136],
  ["tha", "Thai", "ไทย", 896_631],
  ["heb", "Hebrew", "עברית", 580_576, true],
  ["fas", "Persian", "فارسی", 424_507, true],
  ["urd", "Urdu", "اردو", 1_023_740, true],
  ["tam", "Tamil", "தமிழ்", 1_446_167],
  ["tel", "Telugu", "తెలుగు", 1_735_518],
  ["mar", "Marathi", "मराठी", 1_966_154],
  ["nep", "Nepali", "नेपाली", 1_594_252],
  ["guj", "Gujarati", "ગુજરાતી", 1_219_824],
  ["kan", "Kannada", "ಕನ್ನಡ", 1_914_250],
  ["mal", "Malayalam", "മലയാളം", 2_794_667],
  ["pan", "Punjabi", "ਪੰਜਾਬੀ", 1_396_216],
  ["ell", "Greek", "Ελληνικά", 1_324_749],
  ["ces", "Czech", "Čeština", 2_225_029],
  ["ron", "Romanian", "Română", 1_692_160],
  ["hun", "Hungarian", "Magyar", 2_854_466],
  ["swe", "Swedish", "Svenska", 2_503_095],
  ["nor", "Norwegian", "Norsk", 2_490_241],
  ["dan", "Danish", "Dansk", 1_845_116],
  ["fin", "Finnish", "Suomi", 3_795_323],
];

const photo = new Set(PHOTO_LANGS);

export const LANGUAGES: (Language & { bytes: number })[] = LIST.map(
  ([code, name, native, bytes, rtl]) => ({
    code,
    name,
    native,
    bytes,
    ...(rtl ? { rtl } : {}),
    ...(photo.has(code) ? { photo: true } : {}),
  }),
);

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string) {
  return byCode.get(code);
}

export const isLanguage = (code: string) => byCode.has(code);

/** Does the photo engine read every one of these languages? */
export function photoReads(codes: readonly string[]): boolean {
  return codes.length > 0 && codes.every((c) => photo.has(c));
}

/** Is any language photo-ready? (Hides the engine choice while the photo engine isn't there.) */
export const PHOTO_READY = photo.size > 0;

/** Browser language ("de-AT") to a Tesseract code, when we have one */
const BROWSER: Record<string, string> = {
  en: "eng",
  zh: "chi_sim",
  "zh-tw": "chi_tra",
  "zh-hk": "chi_tra",
  ja: "jpn",
  ko: "kor",
  ar: "ara",
  hi: "hin",
  bn: "ben",
  ru: "rus",
  uk: "ukr",
  bg: "bul",
  es: "spa",
  pt: "por",
  fr: "fra",
  de: "deu",
  it: "ita",
  nl: "nld",
  pl: "pol",
  tr: "tur",
  vi: "vie",
  id: "ind",
  ms: "msa",
  th: "tha",
  he: "heb",
  fa: "fas",
  ur: "urd",
  ta: "tam",
  te: "tel",
  mr: "mar",
  ne: "nep",
  gu: "guj",
  kn: "kan",
  ml: "mal",
  pa: "pan",
  el: "ell",
  cs: "ces",
  ro: "ron",
  hu: "hun",
  sv: "swe",
  nb: "nor",
  nn: "nor",
  no: "nor",
  da: "dan",
  fi: "fin",
};

export function browserLanguage(tag: string): string | undefined {
  const t = tag.toLowerCase();
  return BROWSER[t] ?? BROWSER[t.split("-")[0]!];
}
