/**
 * Unit tables. Each unit has a factor to the kind's base unit (metre, kilogram, litre, square
 * metre, metre per second, byte, second, pascal, joule); temperature has its own formulas.
 * Factors are the exact definitions where one exists (1 in = 0.0254 m, 1 lb = 0.45359237 kg).
 */

export interface Unit {
  id: string;
  /** English name, translated by the caller */
  name: string;
  /** Short symbol */
  sym: string;
  /** Value in the base unit for 1 of this unit (unused for temperature) */
  f: number;
}

export interface Kind {
  id: string;
  name: string;
  units: Unit[];
  /** Default from/to */
  from: string;
  to: string;
}

const u = (id: string, name: string, sym: string, f: number): Unit => ({
  id,
  name,
  sym,
  f,
});

export const KINDS: Kind[] = [
  {
    id: "length",
    name: "Length",
    from: "m",
    to: "ft",
    units: [
      u("mm", "Millimetres", "mm", 0.001),
      u("cm", "Centimetres", "cm", 0.01),
      u("m", "Metres", "m", 1),
      u("km", "Kilometres", "km", 1000),
      u("in", "Inches", "in", 0.0254),
      u("ft", "Feet", "ft", 0.3048),
      u("yd", "Yards", "yd", 0.9144),
      u("mi", "Miles", "mi", 1609.344),
      u("nmi", "Nautical miles", "nmi", 1852),
    ],
  },
  {
    id: "weight",
    name: "Weight",
    from: "kg",
    to: "lb",
    units: [
      u("mg", "Milligrams", "mg", 1e-6),
      u("g", "Grams", "g", 0.001),
      u("kg", "Kilograms", "kg", 1),
      u("t", "Tonnes", "t", 1000),
      u("oz", "Ounces", "oz", 0.028349523125),
      u("lb", "Pounds", "lb", 0.45359237),
      u("st", "Stones", "st", 6.35029318),
      u("ton", "US tons", "ton", 907.18474),
    ],
  },
  {
    id: "temperature",
    name: "Temperature",
    from: "c",
    to: "f",
    units: [
      u("c", "Celsius", "°C", 1),
      u("f", "Fahrenheit", "°F", 1),
      u("k", "Kelvin", "K", 1),
    ],
  },
  {
    id: "volume",
    name: "Volume",
    from: "l",
    to: "gal",
    units: [
      u("ml", "Millilitres", "ml", 0.001),
      u("l", "Litres", "l", 1),
      u("m3", "Cubic metres", "m³", 1000),
      u("tsp", "Teaspoons (US)", "tsp", 0.00492892159375),
      u("tbsp", "Tablespoons (US)", "tbsp", 0.01478676478125),
      u("floz", "Fluid ounces (US)", "fl oz", 0.0295735295625),
      u("cup", "Cups (US)", "cup", 0.2365882365),
      u("pt", "Pints (US)", "pt", 0.473176473),
      u("qt", "Quarts (US)", "qt", 0.946352946),
      u("gal", "Gallons (US)", "gal", 3.785411784),
      u("ukpt", "Pints (UK)", "pt UK", 0.56826125),
      u("ukgal", "Gallons (UK)", "gal UK", 4.54609),
      u("ft3", "Cubic feet", "ft³", 28.316846592),
    ],
  },
  {
    id: "area",
    name: "Area",
    from: "m2",
    to: "ft2",
    units: [
      u("cm2", "Square centimetres", "cm²", 1e-4),
      u("m2", "Square metres", "m²", 1),
      u("ha", "Hectares", "ha", 1e4),
      u("km2", "Square kilometres", "km²", 1e6),
      u("in2", "Square inches", "in²", 0.00064516),
      u("ft2", "Square feet", "ft²", 0.09290304),
      u("yd2", "Square yards", "yd²", 0.83612736),
      u("ac", "Acres", "ac", 4046.8564224),
      u("mi2", "Square miles", "mi²", 2589988.110336),
    ],
  },
  {
    id: "speed",
    name: "Speed",
    from: "kmh",
    to: "mph",
    units: [
      u("ms", "Metres per second", "m/s", 1),
      u("kmh", "Kilometres per hour", "km/h", 1 / 3.6),
      u("mph", "Miles per hour", "mph", 0.44704),
      u("kn", "Knots", "kn", 1852 / 3600),
      u("fts", "Feet per second", "ft/s", 0.3048),
    ],
  },
  {
    id: "data",
    name: "Data",
    from: "gb",
    to: "mb",
    units: [
      u("bit", "Bits", "bit", 1 / 8),
      u("b", "Bytes", "B", 1),
      u("kb", "Kilobytes", "kB", 1e3),
      u("mb", "Megabytes", "MB", 1e6),
      u("gb", "Gigabytes", "GB", 1e9),
      u("tb", "Terabytes", "TB", 1e12),
      u("kib", "Kibibytes", "KiB", 1024),
      u("mib", "Mebibytes", "MiB", 1024 ** 2),
      u("gib", "Gibibytes", "GiB", 1024 ** 3),
      u("tib", "Tebibytes", "TiB", 1024 ** 4),
      u("mbit", "Megabits", "Mbit", 1e6 / 8),
      u("gbit", "Gigabits", "Gbit", 1e9 / 8),
    ],
  },
  {
    id: "time",
    name: "Time",
    from: "h",
    to: "min",
    units: [
      u("ms", "Milliseconds", "ms", 0.001),
      u("s", "Seconds", "s", 1),
      u("min", "Minutes", "min", 60),
      u("h", "Hours", "h", 3600),
      u("d", "Days", "d", 86400),
      u("wk", "Weeks", "wk", 604800),
      // An average Gregorian year (365.2425 days) and a twelfth of it
      u("mo", "Months", "mo", 31556952 / 12),
      u("yr", "Years", "yr", 31556952),
    ],
  },
  {
    id: "pressure",
    name: "Pressure",
    from: "bar",
    to: "psi",
    units: [
      u("pa", "Pascals", "Pa", 1),
      u("hpa", "Hectopascals", "hPa", 100),
      u("kpa", "Kilopascals", "kPa", 1000),
      u("bar", "Bar", "bar", 1e5),
      u("psi", "Pounds per square inch", "psi", 6894.757293168361),
      u("atm", "Atmospheres", "atm", 101325),
      u("mmhg", "Millimetres of mercury", "mmHg", 133.322387415),
      u("inhg", "Inches of mercury", "inHg", 3386.389),
    ],
  },
  {
    id: "energy",
    name: "Energy",
    from: "kcal",
    to: "kj",
    units: [
      u("j", "Joules", "J", 1),
      u("kj", "Kilojoules", "kJ", 1000),
      u("cal", "Calories", "cal", 4.184),
      u("kcal", "Kilocalories", "kcal", 4184),
      u("wh", "Watt-hours", "Wh", 3600),
      u("kwh", "Kilowatt-hours", "kWh", 3.6e6),
      u("btu", "British thermal units", "BTU", 1055.05585262),
    ],
  },
];

export function kindOf(id: string): Kind {
  return KINDS.find((k) => k.id === id) ?? KINDS[0]!;
}

function toBase(kind: Kind, unit: Unit, v: number): number {
  if (kind.id !== "temperature") return v * unit.f;
  // Base: kelvin
  if (unit.id === "c") return v + 273.15;
  if (unit.id === "f") return ((v - 32) * 5) / 9 + 273.15;
  return v;
}

function fromBase(kind: Kind, unit: Unit, v: number): number {
  if (kind.id !== "temperature") return v / unit.f;
  if (unit.id === "c") return v - 273.15;
  if (unit.id === "f") return ((v - 273.15) * 9) / 5 + 32;
  return v;
}

export function convert(
  kindId: string,
  from: string,
  to: string,
  v: number,
): number {
  const kind = kindOf(kindId);
  const a = kind.units.find((x) => x.id === from);
  const b = kind.units.find((x) => x.id === to);
  if (!a || !b) return NaN;
  return fromBase(kind, b, toBase(kind, a, v));
}
