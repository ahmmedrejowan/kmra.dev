/**
 * One smoke test (or more) per qrtool tool besides the generator (see roundtrip.spec.ts).
 * The camera can't run headless, so the scanner is tested in image mode only.
 */
import { readFileSync } from "node:fs";
import { test, expect, openTool, addFiles, gen } from "../helpers.ts";
import { QR_LINK, QR_TEXT } from "../fixtures/docs.ts";
import {
  PDFLib,
  decode,
  decodeOne,
  field,
  grab,
  qrFile,
  unzip,
} from "./util.ts";

/* ---------- Scanner (image mode) ---------- */

test("scanner: reads a link from an image", async ({ page }) => {
  await openTool(page, "/scanner");
  await page
    .getByRole("group", { name: "Scan from" })
    .getByRole("button", { name: "Image or screenshot" })
    .click();
  await addFiles(page, gen("qr-link.png"));
  const res = page.locator(".tool-area .scan-results");
  await expect(res.getByText("1 code found")).toBeVisible();
  await expect(res.locator(".tag")).toHaveText(/^QR ?Code$/);
  await expect(res.locator(".scan-host")).toHaveText("kmra.dev");
  await expect(res.locator(".scan-text")).toHaveText(QR_LINK);
  await expect(res.getByRole("link", { name: "Open link" })).toHaveAttribute(
    "href",
    QR_LINK,
  );
  // The code is outlined on the image
  await expect(page.locator(".scan-view svg polygon")).toHaveCount(1);
});

test("scanner: names the format the way the other tools do", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await addFiles(page, gen("qr-link.png"));
  await expect(page.locator(".tool-area .scan-results .tag")).toHaveText(
    "QR Code",
  );
});

test("scanner: two images at once, and an image without a code", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await addFiles(page, [gen("qr-link.png"), gen("qr-text.png")]);
  const res = page.locator(".tool-area .scan-results");
  await expect(res.getByText("2 codes found")).toBeVisible();
  await expect(res.locator(".scan-text").nth(1)).toHaveText(QR_TEXT);
  await addFiles(page, gen("photo-wide.png"));
  await expect(
    page.getByText("No code found. Try a sharper or closer picture."),
  ).toBeVisible();
});

test("scan-qr-from-image: a UPI code shows payee, ID and amount", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(
      await qrFile(
        "upi://pay?pa=shop@okaxis&pn=Rahim%20Store&am=250.00&cu=INR&tn=Order%207",
        "upi.png",
      ),
    );
  const kv = page.locator(".tool-area .scan-result .kv");
  await expect(kv).toContainText("Pay toRahim Store");
  await expect(kv).toContainText("shop@okaxis");
  await expect(kv).toContainText("250.00 INR");
  await expect(kv).toContainText("Order 7");
});

test("scan-qr-from-image: a SEPA code shows IBAN, BIC, amount and reference", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(
      await qrFile(
        "BCD\n002\n1\nSCT\nCOBADEFFXXX\nMax Mustermann\nDE89370400440532013000\nEUR12.5\n\n\nInvoice 2026-1",
        "sepa.png",
      ),
    );
  const kv = page.locator(".tool-area .scan-result .kv");
  await expect(kv).toContainText("Max Mustermann");
  await expect(kv).toContainText("DE89 3704 0044 0532 0130 00");
  await expect(kv).toContainText("COBADEFFXXX");
  await expect(kv).toContainText("12.50 EUR");
  await expect(kv).toContainText("Invoice 2026-1");
});

test("scan-qr-from-image: an event code saves a calendar file", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(
      await qrFile(
        "BEGIN:VEVENT\nSUMMARY:Team lunch\nDTSTART:20261102T123000\nDTEND:20261102T133000\nLOCATION:Cafe\\, Dhaka\nEND:VEVENT",
        "event.png",
      ),
    );
  const kv = page.locator(".tool-area .scan-result .kv");
  await expect(kv).toContainText("Team lunch");
  await expect(kv).toContainText("Cafe, Dhaka");
  const ics = await grab(page, () =>
    page.getByRole("button", { name: "Add to calendar (.ics)" }).click(),
  );
  expect(ics.name).toBe("Team-lunch.ics");
  const text = ics.buffer.toString();
  expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(text).toContain("SUMMARY:Team lunch\r\n");
  expect(text).toContain("DTSTART:20261102T123000\r\n");
  expect(text).toMatch(/\r\nUID:[^\r]+@qrtool\.kmra\.dev\r\n/);
  expect(text).toMatch(/END:VEVENT\r\nEND:VCALENDAR\r\n$/);
});

test("barcode-scanner: opens on the camera without starting it", async ({
  page,
}) => {
  await openTool(page, "/barcode-scanner");
  await expect(
    page.getByRole("button", { name: "Start camera" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Scan from" })
      .getByRole("button", { name: "Camera" }),
  ).toHaveAttribute("aria-pressed", "true");
});

/* ---------- Barcodes ---------- */

const BARCODES: {
  slug: string;
  value?: string;
  file: string;
  format: RegExp;
  text: string;
}[] = [
  {
    slug: "barcode",
    value: "ABC-123/x",
    file: "barcode-code128.png",
    format: /Code ?128/,
    text: "ABC-123/x",
  },
  {
    slug: "code-128",
    file: "barcode-code128.png",
    format: /Code ?128/,
    text: "KMRA-2026-001",
  },
  {
    slug: "ean-13",
    value: "590123412345",
    file: "barcode-ean13.png",
    format: /EAN.?13/,
    // The check digit is added
    text: "5901234123457",
  },
  {
    slug: "isbn-barcode",
    // Dashes as printed in a book
    value: "978-1-4028-9462-6",
    file: "barcode-ean13.png",
    format: /EAN.?13/,
    text: "9781402894626",
  },
  {
    slug: "upc-a",
    value: "03600029145",
    file: "barcode-upc.png",
    // UPC-A is EAN-13 with a leading 0 in bars; zxing reports it as EAN-13
    format: /UPC.?A|EAN.?13/,
    text: "036000291452",
  },
];

for (const b of BARCODES)
  test(`${b.slug}: the PNG scans back`, async ({ page }) => {
    await openTool(page, `/${b.slug}`);
    if (b.value) await field(page, "Number or text").fill(b.value);
    await expect(page.locator(".tool-area .warn")).toHaveCount(0);
    const png = await grab(page, () =>
      page.getByRole("button", { name: "Download PNG" }).click(),
    );
    expect(png.name).toBe(b.file);
    const r = await decodeOne(page, png);
    expect(r.format).toMatch(b.format);
    expect(r.text.replace(/^0(?=\d{12}$)/, "")).toBe(b.text);
  });

test("barcode: wrong input for EAN-13 blocks the download", async ({
  page,
}) => {
  await openTool(page, "/ean-13");
  await field(page, "Number or text").fill("12AB");
  await expect(
    page.getByText("That doesn't fit this barcode type.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeDisabled();
  // A wrong check digit is caught too
  await field(page, "Number or text").fill("5901234123450");
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeDisabled();
});

test("barcode: SVG download scans back", async ({ page }) => {
  await openTool(page, "/barcode");
  await field(page, "Number or text").fill("SVG-42");
  const svg = await grab(page, () =>
    page.getByRole("button", { name: "Download SVG" }).click(),
  );
  expect(svg.name).toBe("barcode-code128.svg");
  expect(svg.buffer.toString()).toContain("<svg");
  expect((await decodeOne(page, svg)).text).toBe("SVG-42");
});

/* ---------- 2D codes ---------- */

const CODES_2D: {
  path: string;
  chip?: string;
  file: string;
  format: RegExp;
}[] = [
  { path: "/data-matrix", file: "data-matrix.png", format: /Data ?Matrix/ },
  { path: "/pdf417", file: "pdf417.png", format: /PDF417/ },
  { path: "/codes-2d", chip: "Aztec", file: "aztec.png", format: /Aztec/ },
  {
    path: "/codes-2d",
    chip: "Micro QR",
    file: "micro-qr.png",
    format: /Micro ?QR/,
  },
  { path: "/codes-2d", chip: "rMQR", file: "rmqr.png", format: /rMQR/i },
];

for (const c of CODES_2D)
  test(`codes-2d ${c.chip ?? c.path}: the PNG scans back`, async ({ page }) => {
    await openTool(page, c.path);
    if (c.chip)
      await page
        .locator(".tool-area")
        .getByRole("button", { name: c.chip, exact: true })
        .click();
    const text = c.chip === "Micro QR" ? "KMRA12345" : "KMRA-2D-001";
    await field(page, "Text or number").fill(text);
    await expect(
      page.getByText("Ready. The code updates as you type."),
    ).toBeVisible();
    const png = await grab(page, () =>
      page.getByRole("button", { name: "Download PNG" }).click(),
    );
    expect(png.name).toBe(c.file);
    const r = await decodeOne(page, png);
    expect(r.format).toMatch(c.format);
    expect(r.text).toBe(text);
  });

/* ---------- Bulk ---------- */

test("bulk: one PNG per line in a zip, each scans back", async ({ page }) => {
  await openTool(page, "/bulk");
  await field(page, "One link or text per line").fill(
    "https://kmra.dev\nTable 1 | https://example.com/menu?table=1\nPlain text line",
  );
  await expect(page.locator(".bulk-grid figure")).toHaveCount(3);
  const zip = await grab(page, () =>
    page.getByRole("button", { name: "Download 3 as zip" }).click(),
  );
  expect(zip.name).toBe("qr-codes-kmra.zip");
  const files = unzip(zip.buffer);
  const names = Object.keys(files).sort();
  expect(names).toHaveLength(3);
  expect(names).toContain("Table-1.png");
  expect(names).toContain("003-Plain-text-line.png");
  const first = names.find((n) => n.startsWith("001-"))!;
  const reads = await decode(
    page,
    Object.entries(files).map(([name, b]) => ({
      name,
      mimeType: "image/png",
      buffer: Buffer.from(b),
    })),
  );
  expect(Object.fromEntries(reads.map((r) => [r.file, r.text]))).toEqual({
    [first]: "https://kmra.dev",
    "Table-1.png": "https://example.com/menu?table=1",
    "003-Plain-text-line.png": "Plain text line",
  });
});

test("bulk: a link without a name gets a file name without the https", async ({
  page,
}) => {
  await openTool(page, "/bulk");
  await field(page, "One link or text per line").fill("https://kmra.dev");
  const zip = await grab(page, () =>
    page.getByRole("button", { name: "Download 1 as zip" }).click(),
  );
  expect(Object.keys(unzip(zip.buffer))).toEqual(["001-kmra.dev.png"]);
});

test("bulk: SVG format", async ({ page }) => {
  await openTool(page, "/bulk");
  await page
    .getByRole("group", { name: "Format" })
    .getByRole("button", { name: "SVG" })
    .click();
  const zip = await grab(page, () =>
    page.getByRole("button", { name: "Download 3 as zip" }).click(),
  );
  const names = Object.keys(unzip(zip.buffer));
  expect(names).toHaveLength(3);
  expect(names.every((n) => n.endsWith(".svg"))).toBe(true);
});

/* ---------- Wi-Fi card ---------- */

test("wifi-card: PNG card's code joins the network; PDF is one page", async ({
  page,
}) => {
  await openTool(page, "/wifi-card");
  await field(page, "Network name (SSID)").fill("Office 5G");
  await field(page, "Password").fill("secret123");
  await expect(page.getByText(/mm\. Prints at real size\./)).toBeVisible();
  const png = await grab(page, () =>
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  );
  expect(png.name).toMatch(/^wifi-card-.+\.png$/);
  const pdf = await grab(page, () =>
    page.getByRole("button", { name: "PDF", exact: true }).click(),
  );
  expect(pdf.name).toMatch(/^wifi-card-.+\.pdf$/);
  const doc = await PDFLib.PDFDocument.load(pdf.buffer);
  expect(doc.getPageCount()).toBe(1);
  const r = await decodeOne(page, png);
  expect(r.text).toBe("WIFI:T:WPA;S:Office 5G;P:secret123;;");
});

test("wifi-card: an open network has no password field", async ({ page }) => {
  await openTool(page, "/wifi-card");
  await field(page, "Network name (SSID)").fill("Guests");
  await page
    .getByRole("group", { name: "Security" })
    .getByRole("button", { name: "None" })
    .click();
  await expect(field(page, "Password")).toHaveCount(0);
  const png = await grab(page, () =>
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  );
  expect((await decodeOne(page, png)).text).toBe("WIFI:T:nopass;S:Guests;;");
});

/* ---------- Batch scan ---------- */

test("batch-scan: many images, a CSV, and the ones without a code", async ({
  page,
}) => {
  await openTool(page, "/batch-scan");
  await addFiles(page, [
    gen("qr-link.png"),
    gen("qr-text.png"),
    gen("photo-wide.png"),
  ]);
  const card = page.locator(".bs-card");
  await expect(card.locator(".controls .lbl")).toHaveText("3 images, 2 codes");
  await expect(card.getByText("1 image without a code")).toBeVisible();
  await expect(card.locator(".bs-table tbody tr")).toHaveCount(3);
  await expect(card.locator("tr.miss")).toContainText("photo-wide.png");
  await expect(card.locator("tr.miss")).toContainText("No code found");

  const csv = await grab(page, () =>
    page.getByRole("button", { name: "Download CSV" }).click(),
  );
  expect(csv.name).toBe("scanned-codes.csv");
  const text = csv.buffer.toString("utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("File,Format,Type,Content");
  expect(lines).toContain(`qr-link.png,QR Code,Link,${QR_LINK}`);
  expect(lines).toContain(`qr-text.png,QR Code,Text,${QR_TEXT}`);
  expect(lines).toContain("photo-wide.png,,,No code found");

  await page.getByLabel("Only images without a code").check();
  await expect(card.locator(".bs-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear list" }).click();
  await expect(page.getByText("Drop images with codes")).toBeVisible();
});

/* ---------- Checker ---------- */

test("checker: a clean code passes, with its content shown", async ({
  page,
}) => {
  await openTool(page, "/checker");
  await addFiles(page, gen("qr-link.png"));
  const panel = page.locator(".tool-area .controls");
  await expect(panel.locator(".qc-content")).toHaveText(QR_LINK);
  await expect(panel.locator(".scan-head .tag")).toHaveText("QR Code · Link");
  await expect(panel.locator(".qc-sum")).toBeVisible({ timeout: 60_000 });
  await expect(panel.locator(".qc-item.fail")).toHaveCount(0);
  await expect(
    panel.locator(".qc-item.pass").filter({ hasText: "Scans" }),
  ).toHaveCount(1);
  await expect(panel.getByText("Good contrast")).toBeVisible();
  await expect(panel.getByText("Enough blank margin")).toBeVisible();
});

test("checker: a margin a pixel short of 4 modules isn't called narrow", async ({
  page,
}) => {
  await openTool(page, "/checker");
  // 13 px modules, 52 px margin on the top and left, 51 px on the bottom and right (3.92 modules)
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(await qrFile(QR_LINK, "qr-480.png", { width: 480 }));
  await expect(page.locator(".tool-area .qc-sum")).toBeVisible();
  await expect(page.getByText("Enough blank margin")).toBeVisible();
});

test("checker: an image with no code says so", async ({ page }) => {
  await openTool(page, "/checker");
  await addFiles(page, gen("photo-wide.png"));
  await expect(page.getByText("No code could be read")).toBeVisible();
  await expect(page.locator(".tool-area .qc-item.fail")).toHaveCount(1);
});

/* ---------- Fix QR ---------- */

test("fix-qr: redraws a code with the same content", async ({ page }) => {
  await openTool(page, "/fix-qr");
  // A soft, low-contrast copy of the code, the kind of image this tool is for
  const blurred = await page.evaluate(
    async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(
        new Blob([bin], { type: "image/png" }),
      );
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const x = c.getContext("2d")!;
      x.fillStyle = "#ddd";
      x.fillRect(0, 0, c.width, c.height);
      x.filter = "blur(1.5px) contrast(0.6)";
      x.drawImage(bmp, 0, 0);
      const out = await c.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await out.arrayBuffer());
      let s = "";
      for (const v of buf) s += String.fromCharCode(v);
      return btoa(s);
    },
    readFileSync(gen("qr-text.png")).toString("base64"),
  );
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles({
      name: "blurry.png",
      mimeType: "image/png",
      buffer: Buffer.from(blurred, "base64"),
    });
  await expect(page.locator(".tool-area .qc-content")).toHaveText(QR_TEXT);
  await expect(
    page.getByText("Same content, clean edges. Ready to print."),
  ).toBeVisible();
  const png = await grab(page, () =>
    page.getByRole("button", { name: "Download PNG" }).click(),
  );
  expect(png.name).toMatch(/\.png$/);
  const r = await decodeOne(page, png);
  expect(r.format).toBe("QR Code");
  expect(r.text).toBe(QR_TEXT);
});
