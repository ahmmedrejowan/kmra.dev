/**
 * devtool inputs: a small Excel workbook (two sheets, a quoted comma, a number, a boolean)
 * written with SheetJS, so the CSV/JSON/Excel converter reads a real .xlsx.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

// SheetJS comes from the devtool app (it isn't a root dependency)
const XLSX = createRequire(
  new URL("../../apps/devtool/package.json", import.meta.url),
)("xlsx") as typeof import("xlsx");

export async function makeDevtoolFixtures(dir: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["id", "name", "price", "active"],
      [1, "Widget, large", 9.5, true],
      [2, "Gadget", 12, false],
    ]),
    "Products",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["city", "country"],
      ["Dhaka", "Bangladesh"],
    ]),
    "Places",
  );
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await writeFile(join(dir, "devtool-sheet.xlsx"), buf);
}
