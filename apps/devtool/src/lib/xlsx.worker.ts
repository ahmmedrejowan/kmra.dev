/**
 * Reads a spreadsheet in a worker. SheetJS parses untrusted files; keeping it off the page means
 * a malformed or hostile file can at worst break this short-lived worker, not the page.
 */
self.onmessage = async (e: MessageEvent<Uint8Array>) => {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(e.data, { type: "array", dense: true });
    const sheets = wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name]!, {
        header: 1,
        raw: false,
        rawNumbers: true,
        defval: null,
        blankrows: false,
      }) as unknown[][],
    }));
    self.postMessage({ ok: true, sheets });
  } catch {
    self.postMessage({ ok: false });
  }
};
