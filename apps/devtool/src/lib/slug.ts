/**
 * URL slugs: accents come off through Unicode decomposition (NFKD), a small map spells out
 * letters that don't decompose (ß, æ, ø, ł, Cyrillic, Greek …), and everything else that isn't
 * a Latin letter or digit becomes a separator.
 */

const MAP: Record<string, string> = {
  ß: "ss",
  ẞ: "SS",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "TH",
  ı: "i",
  ħ: "h",
  Ħ: "H",
  ŧ: "t",
  Ŧ: "T",
  ŋ: "ng",
  Ŋ: "NG",
  ĸ: "k",
  "&": " and ",
  "@": " at ",
  // Cyrillic
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  є: "ye",
  і: "i",
  ї: "yi",
  ґ: "g",
  // Greek
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
};

const STOP = new Set(
  (
    "a an the and or but nor of to in on at for with by from as into onto over under " +
    "is are was were be been am it its this that these those than then so if"
  ).split(" "),
);

export type Separator = "-" | "_" | ".";

export interface SlugOptions {
  separator: Separator;
  lower: boolean;
  /** 0 for no limit */
  maxLength: number;
  stopWords: boolean;
}

function transliterate(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFKC")) {
    const low = ch.toLowerCase();
    const m = MAP[ch] ?? MAP[low];
    if (m === undefined) out += ch;
    // Keep the capital for mapped capitals (Ж → Zh)
    else if (ch !== low && m) out += m[0]!.toUpperCase() + m.slice(1);
    else out += m;
  }
  return out.normalize("NFKD").replace(/\p{M}/gu, "");
}

export function slugify(text: string, o: SlugOptions): string {
  let words = transliterate(text)
    .replace(/['’]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (o.stopWords) {
    const kept = words.filter((w) => !STOP.has(w.toLowerCase()));
    if (kept.length) words = kept;
  }
  if (o.lower) words = words.map((w) => w.toLowerCase());
  let slug = words.join(o.separator);
  if (o.maxLength > 0 && slug.length > o.maxLength) {
    // Cut at the last whole word that fits; a single long word is cut hard
    let cut = "";
    for (const w of words) {
      const next = cut ? cut + o.separator + w : w;
      if (next.length > o.maxLength) break;
      cut = next;
    }
    slug = cut || slug.slice(0, o.maxLength);
  }
  return slug;
}
