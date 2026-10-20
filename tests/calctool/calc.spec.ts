/**
 * CalcTool: every calculator checked against known reference values (loan payments, unit
 * definitions, leap-year ages, daylight saving), every use-case page applies its preset, the
 * Bangla pages are translated, and a coverage check (every ready tool has a test here).
 */
import type { Page } from "@playwright/test";
import { getApp } from "../../packages/registry/src/index.ts";
import { expect, openTool, test } from "../helpers.ts";

const app = getApp("calctool");

const field = (page: Page, name: string) =>
  page.locator(`.tool-area [name="${name}"]`).first();
const hero = (page: Page) =>
  page.locator(".tool-area .calc-hero-value").first();
const stat = (page: Page, id: string) =>
  page.locator(`.tool-area .calc-stats [data-id="${id}"] dd`).first();
const pick = (page: Page, label: string) =>
  page
    .locator(".tool-area")
    .getByRole("button", { name: label, exact: true })
    .first();

/** The answer's unrounded value (data-value), compared to 9 decimal places */
async function num(page: Page, v: number) {
  await expect
    .poll(async () => Number(await hero(page).getAttribute("data-value")))
    .toBeCloseTo(v, 9);
}

async function set(page: Page, values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) await field(page, k).fill(v);
}

test("calculator: precedence, percentages, functions, history and keys", async ({
  page,
}) => {
  await openTool(page, "/calculator");
  const input = page.getByRole("textbox", { name: "Sum" });
  const answer = page.locator(".tool-area .calc-answer");
  const cases: [string, string][] = [
    ["2 + 3 × 4", "14"],
    ["(2 + 3) × 4", "20"],
    ["-2^2", "-4"],
    ["2^3^2", "512"],
    ["200 + 10%", "220"],
    ["12% of 250", "30"],
    ["√144 + 5!", "132"],
    ["sin(30)", "0.5"],
    ["0.1 + 0.2", "0.3"],
    ["1,000 ÷ 8", "125"],
    ["2(3 + 4", "14"],
  ];
  for (const [e, v] of cases) {
    await input.fill(e);
    await expect(answer, e).toHaveText(v);
  }
  await input.fill("1/0");
  await expect(page.locator(".tool-area .calc-screen .calc-msg")).toHaveText(
    "You can't divide by zero.",
  );
  // Enter keeps the answer in the history and leaves it in the field
  await input.fill("6 × 7");
  await input.press("Enter");
  await expect(input).toHaveValue("42");
  await expect(page.locator(".calc-history li").first()).toContainText("6 × 7");
  // The keypad: AC, then 9 ÷ 4 =
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  for (const k of ["9", "Divide", "4"])
    await page
      .locator(".calc-keys")
      .getByRole("button", { name: k, exact: true })
      .click();
  await expect(answer).toHaveText("2.25");
  await page
    .locator(".calc-keys")
    .getByRole("button", { name: "Equals" })
    .click();
  await expect(page.locator(".calc-history li")).toHaveCount(2);
  // Radians
  await input.fill("cos(π)");
  await pick(page, "Radians").click();
  await expect(answer).toHaveText("-1");
});

test("scientific mode: functions, 2nd, keys, memory, and it's remembered", async ({ page }) => {
  await openTool(page, "/calculator");
  const input = page.getByRole("textbox", { name: "Sum" });
  const answer = page.locator(".tool-area .calc-answer");
  const msg = page.locator(".tool-area .calc-screen .calc-msg");
  const key = (name: string) =>
    page.locator(".tool-area .calc-pads").getByRole("button", { name, exact: true });
  await expect(page.locator(".calc-sci")).toHaveCount(0);
  await pick(page, "Scientific").click();
  await expect(page.locator(".calc-sci button")).toHaveCount(25);
  // Typed functions and operators, checked against known values
  const cases: [string, string][] = [
    ["5 nCr 2", "10"],
    ["52 nCr 5", "2,598,960"],
    ["5 nPr 2", "20"],
    ["27 root 3", "3"],
    ["-8 root 3", "-2"],
    ["sinh(0) + cosh(0)", "1"],
    ["tanh(1)", "0.761594156"],
    ["asinh(1)", "0.881373587"],
    ["exp(1)", "2.7182818285"],
    ["2E3", "2,000"],
    ["1.5E-3 × 2", "0.003"],
    ["10^3 + e^0", "1,001"],
    ["asin(0.5)", "30"],
    ["17 mod 5", "2"],
  ];
  for (const [e, v] of cases) {
    await input.fill(e);
    await expect(answer, e).toHaveText(v);
  }
  await input.fill("acosh(0.5)");
  await expect(msg).toHaveText("acosh takes values from 1 up.");
  // 2nd turns sin into sin⁻¹ for one key press
  await key("Clear").click();
  await key("Second functions").click();
  await expect(key("Second functions")).toHaveAttribute("aria-pressed", "true");
  await key("Inverse sine").click();
  await expect(key("Second functions")).toHaveAttribute("aria-pressed", "false");
  await expect(key("Sine")).toBeVisible();
  for (const k of ["1", "Divide", "2", ")"]) await key(k).click();
  await expect(input).toHaveValue("asin(1÷2)");
  await expect(answer).toHaveText("30");
  // 1/x and ± wrap what's on screen
  await input.fill("4");
  await key("Reciprocal").click();
  await expect(input).toHaveValue("1/(4)");
  await expect(answer).toHaveText("0.25");
  await key("Change sign").click();
  await expect(answer).toHaveText("-0.25");
  await key("Change sign").click();
  await expect(input).toHaveValue("1/(4)");
  // Memory: M+ and M− use the answer on screen, MR puts it back, MC clears it
  await input.fill("6 × 7");
  await key("Add to memory").click();
  await expect(page.locator(".calc-mem")).toHaveText("M = 42");
  await input.fill("2");
  await key("Subtract from memory").click();
  await expect(page.locator(".calc-mem")).toHaveText("M = 40");
  await key("Clear").click();
  await key("Recall memory").click();
  await expect(input).toHaveValue("40");
  await key("Times ten to the power").click();
  await expect(answer).toHaveText("40");
  await key("2").click();
  await expect(answer).toHaveText("4,000");
  // The mode and the memory are remembered
  await page.reload();
  await expect(page.locator(".calc-sci button")).toHaveCount(25);
  await expect(page.locator(".calc-mem")).toHaveText("M = 40");
  await key("Clear memory").click();
  await expect(page.locator(".calc-mem")).toHaveCount(0);
  // Keys pressed faster than the page redraws still land in order
  await page.evaluate(() => {
    const k = (n: string) =>
      [...document.querySelectorAll<HTMLButtonElement>(".calc-pads button")].find(
        (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === n,
      )!;
    for (const n of ["Clear", "1", "2", "Combinations", "3", "Delete", "4"]) k(n).click();
  });
  await expect(input).toHaveValue("12 nCr 4");
  await expect(answer).toHaveText("495");
  await pick(page, "Basic").click();
  await expect(page.locator(".calc-sci")).toHaveCount(0);
});

test("home: the hero calculator works and opens the full one", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Sum" });
  await input.fill("12% of 250");
  await expect(page.locator(".calc-mini-ans")).toHaveText("= 30");
  await page.getByRole("button", { name: "√144" }).click();
  await expect(page.locator(".calc-mini-ans")).toHaveText("= 12");
  await page.getByRole("link", { name: "Open the full calculator" }).click();
  await expect(page).toHaveURL(/\/calculator$/);
  await expect(page.getByRole("textbox", { name: "Sum" })).toHaveValue("√144");
  await expect(page.locator(".tool-area .calc-answer")).toHaveText("12");
});

test("percentage: of, is what percent, change", async ({ page }) => {
  await openTool(page, "/percentage");
  await set(page, { a: "15", b: "80" });
  await expect(hero(page)).toHaveText("12");
  await expect(stat(page, "plus")).toHaveText("92");
  await pick(page, "X is what % of Y").click();
  await set(page, { a: "45", b: "60" });
  await expect(hero(page)).toHaveText("75%");
  await pick(page, "% change").click();
  await set(page, { a: "50", b: "75" });
  await expect(hero(page)).toHaveText("+50%");
  await set(page, { a: "75", b: "50" });
  await expect(hero(page)).toHaveText("−33.3333%");
  await set(page, { a: "0" });
  await expect(page.locator(".calc-wait")).toContainText("A change from 0");
  await set(page, { a: "abc" });
  await expect(page.locator(".calc-msg").first()).toHaveText(
    "Type a number, like 1250.50.",
  );
});

test("discount: percent, stacked and amount off", async ({ page }) => {
  await openTool(page, "/discount");
  await set(page, { price: "80", off: "25" });
  await expect(hero(page)).toHaveText("60.00");
  await expect(stat(page, "saved")).toHaveText("20.00");
  await page.getByLabel("Add a second discount").check();
  await set(page, { off2: "10" });
  await expect(hero(page)).toHaveText("54.00");
  await expect(stat(page, "pct")).toHaveText("32.5%");
  await page.getByLabel("Add a second discount").uncheck();
  await pick(page, "Amount off").click();
  await set(page, { off: "15" });
  await expect(hero(page)).toHaveText("65.00");
});

test("tip: tip, split and round up", async ({ page }) => {
  await openTool(page, "/tip");
  await set(page, { bill: "64.50", tip: "15", people: "2" });
  await expect(hero(page)).toHaveText("37.09");
  await expect(stat(page, "total")).toHaveText("74.18");
  await page.getByLabel("Round up each share to a whole amount").check();
  await expect(hero(page)).toHaveText("38.00");
  await expect(stat(page, "total")).toHaveText("76.00");
  await set(page, { people: "0" });
  await expect(page.locator(".calc-msg").first()).toHaveText("Type 1 or more.");
});

test("sales tax: add and remove", async ({ page }) => {
  await openTool(page, "/sales-tax");
  await set(page, { price: "100", rate: "15" });
  await expect(hero(page)).toHaveText("115.00");
  await pick(page, "Remove tax").click();
  await set(page, { price: "115" });
  await expect(hero(page)).toHaveText("100.00");
  await expect(stat(page, "tax")).toHaveText("15.00");
  await pick(page, "20%").click();
  await set(page, { price: "120" });
  await expect(hero(page)).toHaveText("100.00");
});

test("fractions: mixed numbers, simplified, with steps", async ({ page }) => {
  await openTool(page, "/fraction");
  await set(page, { a: "1/3", b: "2 1/4" });
  await expect(hero(page)).toHaveAttribute("data-value", "31/12");
  await expect(stat(page, "mixed")).toHaveText("2 7/12");
  await expect(page.locator(".calc-how")).toContainText(
    "common denominator 12",
  );
  await pick(page, "÷").click();
  await set(page, { a: "3/4", b: "1/2" });
  await expect(hero(page)).toHaveAttribute("data-value", "3/2");
  await expect(stat(page, "decimal")).toHaveText("1.5");
  await pick(page, "×").click();
  await set(page, { a: "0.75", b: "-2/3" });
  await expect(hero(page)).toHaveAttribute("data-value", "-1/2");
  await set(page, { b: "1/0" });
  await expect(page.locator(".calc-msg").first()).toHaveText(
    "The bottom number can't be 0.",
  );
});

test("aspect ratio: ratio and missing side", async ({ page }) => {
  await openTool(page, "/aspect-ratio");
  await set(page, { w: "1920", h: "1080" });
  await expect(hero(page)).toHaveText("16:9");
  await set(page, { nw: "1280" });
  await expect(stat(page, "new")).toHaveText("720");
  await set(page, { nh: "300" });
  await expect(stat(page, "new")).toHaveText("533.33");
  await set(page, { w: "1024", h: "768" });
  await expect(hero(page)).toHaveText("4:3");
  await pick(page, "1:1").click();
  await expect(hero(page)).toHaveText("1:1");
});

test("loan: reference payment, interest and schedule", async ({ page }) => {
  await openTool(page, "/loan");
  await set(page, { amount: "100000", rate: "5", years: "30", months: "0" });
  await expect(hero(page)).toHaveText("536.82");
  await expect(stat(page, "interest")).toHaveText("93,255.78");
  await expect(page.locator(".calc-table tbody tr")).toHaveCount(30);
  await expect(page.locator(".calc-table tbody tr").last()).toContainText(
    "0.00",
  );
  await pick(page, "By month").click();
  await expect(page.locator(".calc-table tbody tr")).toHaveCount(24);
  await page.getByRole("button", { name: "Show all 360 rows" }).click();
  await expect(page.locator(".calc-table tbody tr")).toHaveCount(360);
  // First month: 100000 × 5%/12 = 416.67 interest
  await expect(page.locator(".calc-table tbody tr").first()).toContainText(
    "416.67",
  );
  // No interest: just the amount split evenly
  await set(page, { rate: "0", years: "1" });
  await expect(hero(page)).toHaveText("8,333.33");
});

test("compound interest: reference growth and compounding", async ({
  page,
}) => {
  await openTool(page, "/compound-interest");
  await set(page, { start: "10000", monthly: "0", rate: "5", years: "10" });
  await page.locator('[name="freq"]').selectOption("1");
  await expect(hero(page)).toHaveText("16,288.95");
  await page.locator('[name="freq"]').selectOption("12");
  await expect(hero(page)).toHaveText("16,470.09");
  await expect(page.locator(".calc-table tbody tr")).toHaveCount(10);
  // Deposits only, no interest
  await set(page, { start: "0", monthly: "100", rate: "0", years: "2" });
  await expect(hero(page)).toHaveText("2,400.00");
});

test("salary: hourly to yearly and back", async ({ page }) => {
  await openTool(page, "/salary");
  await pick(page, "Hour").click();
  await set(page, { amount: "25", hours: "40", weeks: "52" });
  await expect(hero(page)).toHaveText("52,000.00");
  await expect(stat(page, "month")).toHaveText("4,333.33");
  await pick(page, "Year").click();
  await set(page, { amount: "52000" });
  await expect(stat(page, "hour")).toHaveText("25.00");
});

test("age: exact years, months and days across leap years", async ({
  page,
}) => {
  await openTool(page, "/age");
  await set(page, { birth: "2000-02-29", on: "2025-02-28" });
  await expect(hero(page)).toHaveAttribute("data-value", "24y 11m 30d");
  await set(page, { on: "2025-03-01" });
  await expect(hero(page)).toHaveAttribute("data-value", "25y 0m 0d");
  await expect(stat(page, "next")).toContainText("Today");
  await set(page, { on: "2024-02-29" });
  await expect(hero(page)).toHaveAttribute("data-value", "24y 0m 0d");
  await set(page, { birth: "1990-06-15", on: "2026-10-09" });
  await expect(hero(page)).toHaveText("36 years");
  await expect(stat(page, "days")).toHaveText("13,265");
  await expect(stat(page, "next")).toHaveText("In 249 days");
  await set(page, { birth: "2030-01-01" });
  await expect(page.locator(".calc-wait")).toContainText("after");
});

test("date difference: days, working days and adding months", async ({
  page,
}) => {
  await openTool(page, "/date-difference");
  await set(page, { from: "2026-01-01", to: "2026-12-31" });
  await expect(hero(page)).toHaveAttribute("data-value", "364");
  await page.getByLabel("Count the end date too").check();
  await expect(hero(page)).toHaveAttribute("data-value", "365");
  await page.getByLabel("Count the end date too").uncheck();
  // Monday to the next Monday: five working days
  await set(page, { from: "2026-01-05", to: "2026-01-12" });
  await expect(stat(page, "work")).toHaveText("5");
  // Over a leap day
  await set(page, { from: "2024-02-01", to: "2024-03-01" });
  await expect(hero(page)).toHaveAttribute("data-value", "29");
  await pick(page, "Add or subtract").click();
  await set(page, { from: "2024-01-31", amount: "1" });
  await page.locator('[name="unit"]').selectOption("months");
  await expect(hero(page)).toHaveAttribute("data-value", "2024-02-29");
  await page.locator('[name="unit"]').selectOption("days");
  await set(page, { amount: "90" });
  await expect(hero(page)).toHaveAttribute("data-value", "2024-04-30");
  await pick(page, "Subtract").click();
  await set(page, { amount: "31" });
  await expect(hero(page)).toHaveAttribute("data-value", "2023-12-31");
});

test("time calculator: durations and overnight spans", async ({ page }) => {
  await openTool(page, "/time-calculator");
  await set(page, { t0: "2:45", t1: "1:30" });
  await expect(hero(page)).toHaveText("4:15");
  await page.getByRole("button", { name: "Add a time" }).click();
  await set(page, { t2: "45m" });
  await page
    .locator(".calc-line")
    .nth(2)
    .getByRole("button", { name: "Subtract" })
    .click();
  await expect(hero(page)).toHaveText("3:30");
  await set(page, { t2: "2h 15m 30s" });
  await expect(hero(page)).toHaveText("1:59:30");
  await set(page, { t2: "nonsense" });
  await expect(page.locator(".calc-msg").first()).toContainText(
    "Write it like",
  );
  await pick(page, "Time between two times").click();
  await set(page, { start: "22:00", end: "06:30", break: "30" });
  await expect(hero(page)).toHaveText("8:00");
  await expect(page.locator(".calc-hero-label")).toContainText("past midnight");
});

test.describe("time zones", () => {
  test.use({ timezoneId: "UTC", locale: "en-US" });
  test("converts across zones with daylight saving", async ({ page }) => {
    await openTool(page, "/time-zones");
    await expect(page.locator('[name="date"]')).toBeVisible();
    await page.locator("#calc-from").selectOption("UTC");
    await set(page, { date: "2026-01-15", time: "12:00" });
    const at = (z: string) =>
      page.locator(`[data-zone="${z}"] .calc-zone-time`);
    await expect(at("America/New_York")).toHaveAttribute("data-value", "07:00");
    await expect(at("Asia/Tokyo")).toHaveAttribute("data-value", "21:00");
    await expect(at("Australia/Sydney")).toHaveAttribute(
      "data-date",
      "2026-01-15",
    );
    await expect(at("Australia/Sydney")).toHaveAttribute("data-value", "23:00");
    // Summer: New York is on daylight saving time, Sydney isn't
    await set(page, { date: "2026-07-15" });
    await expect(at("America/New_York")).toHaveAttribute("data-value", "08:00");
    await expect(at("Australia/Sydney")).toHaveAttribute("data-value", "22:00");
    await page.locator("#calc-addzone").selectOption("Asia/Singapore");
    await expect(at("Asia/Singapore")).toHaveAttribute("data-value", "20:00");
    // From New York, 21:00 is the next day in Tokyo
    await page.locator("#calc-from").selectOption("America/New_York");
    await set(page, { date: "2026-07-15", time: "21:00" });
    await expect(at("Asia/Tokyo")).toHaveAttribute("data-value", "10:00");
    await expect(at("Asia/Tokyo")).toHaveAttribute("data-date", "2026-07-16");
    await page.getByRole("button", { name: "Remove Tokyo" }).click();
    await expect(at("Asia/Tokyo")).toHaveCount(0);
  });
});

test("BMI: metric, imperial and category", async ({ page }) => {
  await openTool(page, "/bmi");
  await set(page, { cm: "175", kg: "70" });
  await expect(hero(page)).toHaveText("22.9");
  await expect(page.locator(".calc-hero-sub")).toHaveText("Healthy weight");
  await set(page, { kg: "95" });
  await expect(hero(page)).toHaveText("31.0");
  await expect(page.locator(".calc-hero-sub")).toHaveText("Obese");
  await pick(page, "Imperial (ft, lb)").click();
  await set(page, { ft: "5", in: "9", lb: "154" });
  await expect(hero(page)).toHaveText("22.7");
});

test("calories: Mifflin–St Jeor and activity", async ({ page }) => {
  await openTool(page, "/calories");
  await pick(page, "Male").click();
  await set(page, { age: "30", cm: "180", kg: "80" });
  await page.locator('[name="activity"]').selectOption("1.2");
  await expect(page.locator('[data-id="bmr"] dd')).toHaveAttribute(
    "data-value",
    "1780",
  );
  await expect(hero(page)).toHaveText("2,136");
  await pick(page, "Female").click();
  await expect(page.locator('[data-id="bmr"] dd')).toHaveAttribute(
    "data-value",
    "1614",
  );
  await expect(page.locator(".calc-table tbody tr")).toHaveCount(6);
});

test("unit converter: exact definitions and every unit", async ({ page }) => {
  await openTool(page, "/unit-converter");
  await pick(page, "Length").click();
  await page.locator('[name="from"]').selectOption("in");
  await page.locator('[name="to"]').selectOption("cm");
  await set(page, { value: "1" });
  await num(page, 2.54);
  await expect(stat(page, "mm")).toHaveText("25.4 mm");
  await pick(page, "Temperature").click();
  await set(page, { value: "0" });
  await num(page, 32);
  await set(page, { value: "-40" });
  await num(page, -40);
  await set(page, { value: "-300" });
  await expect(page.locator(".calc-wait")).toContainText("absolute zero");
  await pick(page, "Data").click();
  await page.locator('[name="from"]').selectOption("gib");
  await page.locator('[name="to"]').selectOption("mb");
  await set(page, { value: "1" });
  await num(page, 1073.741824);
  await pick(page, "Swap units").click();
  await set(page, { value: "1073.741824" });
  await num(page, 1);
});

const presets: [string, (page: Page) => Promise<void>][] = [
  [
    "scientific-calculator",
    async (p) => {
      await expect(pick(p, "Scientific")).toHaveAttribute("aria-pressed", "true");
      await expect(p.locator(".calc-sci button")).toHaveCount(25);
    },
  ],
  [
    "what-percent-of",
    async (p) => {
      await expect(pick(p, "X is what % of Y")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(hero(p)).toHaveText("75%");
    },
  ],
  [
    "percentage-change",
    async (p) => {
      await expect(pick(p, "% change")).toHaveAttribute("aria-pressed", "true");
      await expect(hero(p)).toHaveText("+50%");
    },
  ],
  [
    "emi-calculator",
    async (p) => {
      await expect(hero(p)).toHaveText("1,887.12");
    },
  ],
  [
    "mortgage-calculator",
    async (p) => {
      await expect(field(p, "years")).toHaveValue("30");
      await expect(hero(p)).toHaveText("536.82");
    },
  ],
  [
    "hourly-to-salary",
    async (p) => {
      await expect(pick(p, "Hour")).toHaveAttribute("aria-pressed", "true");
      await expect(hero(p)).toHaveText("52,000.00");
    },
  ],
  [
    "how-old-am-i",
    async (p) => {
      await expect(hero(p)).toContainText("years");
    },
  ],
  [
    "days-between-dates",
    async (p) => {
      await expect(hero(p)).toContainText("day");
    },
  ],
  [
    "split-the-bill",
    async (p) => {
      await expect(field(p, "tip")).toHaveValue("0");
      await expect(hero(p)).toHaveText("32.25");
    },
  ],
  [
    "vat-calculator",
    async (p) => {
      await expect(field(p, "rate")).toHaveValue("20");
      await expect(hero(p)).toHaveText("120.00");
    },
  ],
  [
    "cm-to-inches",
    async (p) => {
      await expect(field(p, "from")).toHaveValue("cm");
      await expect(field(p, "to")).toHaveValue("in");
      await set(p, { value: "2.54" });
      await num(p, 1);
    },
  ],
  [
    "kg-to-lbs",
    async (p) => {
      await expect(field(p, "to")).toHaveValue("lb");
      await set(p, { value: "0.45359237" });
      await num(p, 1);
    },
  ],
  [
    "celsius-to-fahrenheit",
    async (p) => {
      await set(p, { value: "100" });
      await num(p, 212);
    },
  ],
  [
    "km-to-miles",
    async (p) => {
      await set(p, { value: "1.609344" });
      await num(p, 1);
    },
  ],
];

for (const [slug, check] of presets)
  test(`use case ${slug} applies its preset`, async ({ page }) => {
    await openTool(page, `/${slug}`);
    await check(page);
  });

test("every use case has a preset test", () => {
  expect(app.tasks.map((t) => t.slug).sort()).toEqual(
    presets.map(([s]) => s).sort(),
  );
});

test("Bangla pages are translated, with Bangla digits", async ({ page }) => {
  await openTool(page, "/bn/loan");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1")).toContainText("লোন");
  await expect(page.locator(".tool-area .calc-hero-label")).toHaveText(
    "মাসিক কিস্তি",
  );
  await expect(hero(page)).toHaveText("১,৮৮৭.১২");
  // Bangla digits typed into a field work too
  await set(page, { amount: "২০০০০০" });
  await expect(hero(page)).toHaveText("৩,৭৭৪.২৫");
  // The scientific calculator in Bangla
  await openTool(page, "/bn/scientific-calculator");
  await expect(page.locator("h1")).toHaveText("সায়েন্টিফিক ক্যালকুলেটর");
  await expect(pick(page, "সায়েন্টিফিক")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "হিসাব" }).fill("৫ nCr ২");
  await expect(page.locator(".tool-area .calc-answer")).toHaveText("১০");
  await expect(page.getByRole("button", { name: "বিপরীত সংখ্যা" })).toBeVisible();
  await page.goto("/bn");
  await expect(page.locator("h1")).toContainText("ক্যালকুলেটর");
  await page.locator(".calc-mini input").fill("২ + ৩");
  await expect(page.locator(".calc-mini-ans")).toHaveText("= ৫");
});

test("every ready tool has a test above", () => {
  const tested = new Set([
    "calculator",
    "percentage",
    "discount",
    "tip",
    "sales-tax",
    "fraction",
    "aspect-ratio",
    "loan",
    "compound-interest",
    "salary",
    "age",
    "date-difference",
    "time-calculator",
    "time-zones",
    "bmi",
    "calories",
    "unit-converter",
  ]);
  const missing = app.tools.filter((t) => t.ready && !tested.has(t.slug));
  expect(missing.map((t) => t.slug)).toEqual([]);
});
