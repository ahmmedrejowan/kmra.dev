/**
 * Generator task pages: fill the form, download the PNG, read it back with the site's own scanner
 * and compare with the exact payload the type should produce.
 */
import { test, expect, openTool } from "../helpers.ts";
import { decodeOne, field, grab } from "./util.ts";

interface Case {
  slug: string;
  fill: [label: string, value: string][];
  /** Chips or segments to press first, by name */
  press?: string[];
  payload: string;
  file: string;
}

const CASES: Case[] = [
  {
    slug: "link-qr",
    fill: [["Link", "kmra.dev/x?a=1"]],
    payload: "https://kmra.dev/x?a=1",
    file: "qr-url-kmra.png",
  },
  {
    slug: "wifi-qr",
    fill: [
      ["Network name (SSID)", "Cafe;Guest"],
      ["Password", "p@ss:word"],
    ],
    payload: "WIFI:T:WPA;S:Cafe\\;Guest;P:p@ss\\:word;;",
    file: "qr-wifi-kmra.png",
  },
  {
    slug: "contact-qr",
    fill: [
      ["First name", "Ada"],
      ["Last name", "Lovelace"],
      ["Phone", "+44 20 7946 0000"],
      ["Email", "ada@example.com"],
      ["Company", "Analytical Ltd"],
    ],
    payload: [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "FN:Ada Lovelace",
      "ORG:Analytical Ltd",
      "TEL;TYPE=CELL:+44 20 7946 0000",
      "EMAIL:ada@example.com",
      "END:VCARD",
    ].join("\n"),
    file: "qr-vcard-kmra.png",
  },
  {
    slug: "email-qr",
    fill: [
      ["Email address", "hi@kmra.dev"],
      ["Subject", "Hello there"],
      ["Message", "Line one"],
    ],
    payload: "mailto:hi@kmra.dev?subject=Hello%20there&body=Line%20one",
    file: "qr-email-kmra.png",
  },
  {
    slug: "sms-qr",
    fill: [
      ["Phone number", "+880 1712-345678"],
      ["Message", "On my way"],
    ],
    payload: "SMSTO:+8801712345678:On my way",
    file: "qr-sms-kmra.png",
  },
  {
    slug: "whatsapp-qr",
    fill: [
      ["WhatsApp number with country code", "+880 1712 345678"],
      ["Message (optional)", "Hi there"],
    ],
    payload: "https://wa.me/8801712345678?text=Hi%20there",
    file: "qr-whatsapp-kmra.png",
  },
  {
    slug: "location-qr",
    fill: [["Coordinates", "23.8103, 90.4125"]],
    payload: "geo:23.8103,90.4125",
    file: "qr-geo-kmra.png",
  },
  {
    slug: "event-qr",
    fill: [
      ["Event name", "Team lunch"],
      ["Starts", "2026-11-02T12:30"],
      ["Place (optional)", "Cafe, Dhaka"],
    ],
    payload: [
      "BEGIN:VEVENT",
      "SUMMARY:Team lunch",
      "DTSTART:20261102T123000",
      // The end follows the start, one hour later
      "DTEND:20261102T133000",
      "LOCATION:Cafe\\, Dhaka",
      "END:VEVENT",
    ].join("\n"),
    file: "qr-event-kmra.png",
  },
  {
    slug: "instagram-qr",
    fill: [["Username or profile link", "@kmra.dev"]],
    payload: "https://instagram.com/kmra.dev",
    file: "qr-instagram-kmra.png",
  },
  {
    slug: "facebook-qr",
    fill: [["Username or profile link", "kmradev"]],
    payload: "https://facebook.com/kmradev",
    file: "qr-facebook-kmra.png",
  },
  {
    slug: "youtube-qr",
    fill: [["Username or profile link", "kmra"]],
    payload: "https://youtube.com/@kmra",
    file: "qr-youtube-kmra.png",
  },
  {
    slug: "telegram-qr",
    fill: [
      ["Username or profile link", "https://t.me/kmra_bot?utm_source=share"],
    ],
    // Pasted links are kept, minus tracking parameters
    payload: "https://t.me/kmra_bot",
    file: "qr-telegram-kmra.png",
  },
  {
    slug: "upi-qr",
    fill: [
      ["UPI ID", "shop@okaxis"],
      ["Payee name", "Rahim Store"],
      ["Amount in rupees (optional)", "250"],
      ["Note (optional)", "Order 7"],
    ],
    payload:
      "upi://pay?pa=shop@okaxis&pn=Rahim%20Store&am=250.00&cu=INR&tn=Order%207",
    file: "qr-upi-kmra.png",
  },
  {
    slug: "sepa-qr",
    fill: [
      ["Account holder name", "Max Mustermann"],
      ["IBAN", "DE89 3704 0044 0532 0130 00"],
      ["BIC (optional)", "COBADEFFXXX"],
      ["Amount in euros (optional)", "12,50"],
      ["Reference (optional)", "Invoice 2026-1"],
    ],
    payload: [
      "BCD",
      "002",
      "1",
      "SCT",
      "COBADEFFXXX",
      "Max Mustermann",
      "DE89370400440532013000",
      "EUR12.50",
      "",
      "",
      "Invoice 2026-1",
    ].join("\n"),
    file: "qr-epc-kmra.png",
  },
  {
    slug: "bitcoin-qr",
    fill: [
      ["Bitcoin address", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"],
      ["Amount in BTC (optional)", "0.001"],
      ["Label (optional)", "Donation"],
    ],
    payload:
      "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001&label=Donation",
    file: "qr-bitcoin-kmra.png",
  },
  {
    slug: "generator",
    press: ["Text"],
    fill: [["Text", "Grüße, বাংলা ✓ — line 1\nline 2"]],
    payload: "Grüße, বাংলা ✓ — line 1\nline 2",
    file: "qr-text-kmra.png",
  },
];

for (const c of CASES)
  test(`${c.slug}: the PNG scans back to the exact payload`, async ({
    page,
  }) => {
    await openTool(page, `/${c.slug}`);
    for (const name of c.press ?? [])
      await page
        .locator(".tool-area")
        .getByRole("button", { name, exact: true })
        .click();
    for (const [label, value] of c.fill) await field(page, label).fill(value);
    // No warnings for valid input
    await expect(page.locator(".tool-area .controls .warn")).toHaveCount(0);
    await expect(
      page.getByText("Ready to scan. It never expires and has no tracking."),
    ).toBeVisible();
    const png = await grab(page, () =>
      page.getByRole("button", { name: "Download PNG" }).click(),
    );
    expect(png.name).toBe(c.file);
    expect(png.buffer.subarray(1, 4).toString()).toBe("PNG");
    const r = await decodeOne(page, png);
    expect(r.format).toBe("QR Code");
    expect(r.text).toBe(c.payload);
  });

test("generator: SVG download scans too, with a styled code", async ({
  page,
}) => {
  await openTool(page, "/generator");
  await field(page, "Link").fill("https://kmra.dev/svg");
  await page
    .getByRole("group", { name: "Dots", exact: true })
    .getByRole("button", { name: "Rounded" })
    .click();
  await page
    .getByRole("group", { name: "Corners" })
    .getByRole("button", { name: "Circle" })
    .click();
  const svg = await grab(page, () =>
    page.getByRole("button", { name: "SVG", exact: true }).click(),
  );
  expect(svg.name).toBe("qr-url-kmra.svg");
  expect(svg.buffer.toString()).toMatch(/^<svg [^>]*viewBox/);
  const r = await decodeOne(page, svg);
  expect(r.text).toBe("https://kmra.dev/svg");
});

test("generator: Simple mode keeps the code and the download", async ({
  page,
}) => {
  await openTool(page, "/generator");
  await page.locator("[data-mode=simple]").click();
  await expect(page.getByRole("group", { name: "Corners" })).toHaveCount(0);
  await field(page, "Link").fill("https://kmra.dev/simple");
  const png = await grab(page, () =>
    page.getByRole("button", { name: "Download PNG" }).click(),
  );
  expect((await decodeOne(page, png)).text).toBe("https://kmra.dev/simple");
});

test("generator: a bad IBAN or UPI ID warns but doesn't block", async ({
  page,
}) => {
  await openTool(page, "/sepa-qr");
  await field(page, "Account holder name").fill("Max");
  await field(page, "IBAN").fill("DE00 1234 5678 9012 3456 78");
  await expect(
    page.getByText("This IBAN doesn't add up. Check it for typos."),
  ).toBeVisible();
  await openTool(page, "/upi-qr");
  await field(page, "UPI ID").fill("not an id@");
  await expect(page.getByText("Enter a UPI ID like name@bank.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeEnabled();
});
