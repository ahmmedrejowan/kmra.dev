/**
 * Hashes a file in chunks off the main thread: MD5, SHA-1, SHA-256, SHA-384 and SHA-512 in one
 * pass (or their HMACs with a key), reporting progress. hash-wasm is loaded on first use.
 */
export const ALGOS = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type Algo = (typeof ALGOS)[number];

export type HashRequest = { id: number; file: Blob; key: string | null };
export type HashReply =
  | { id: number; type: "progress"; done: number }
  | { id: number; type: "done"; digests: Record<Algo, Uint8Array> }
  | { id: number; type: "error"; error: string };

const CHUNK = 4 * 1024 * 1024;
let current = 0;

self.onmessage = async ({ data }: MessageEvent<HashRequest>) => {
  const { id, file, key } = data;
  current = id;
  const post = (m: HashReply) => (self as unknown as Worker).postMessage(m);
  try {
    const hw = await import("hash-wasm");
    const makers = {
      MD5: hw.createMD5,
      "SHA-1": hw.createSHA1,
      "SHA-256": hw.createSHA256,
      "SHA-384": hw.createSHA384,
      "SHA-512": hw.createSHA512,
    } satisfies Record<Algo, () => ReturnType<typeof hw.createMD5>>;
    const hashers = await Promise.all(
      ALGOS.map((a) =>
        key === null ? makers[a]() : hw.createHMAC(makers[a](), key),
      ),
    );
    hashers.forEach((h) => h.init());
    for (let at = 0; at < file.size; at += CHUNK) {
      // A newer file was picked: stop this one
      if (current !== id) return;
      const buf = new Uint8Array(
        await file.slice(at, at + CHUNK).arrayBuffer(),
      );
      for (const h of hashers) h.update(buf);
      post({ id, type: "progress", done: Math.min(file.size, at + CHUNK) });
    }
    const digests = Object.fromEntries(
      ALGOS.map((a, i) => [a, hashers[i]!.digest("binary")]),
    ) as Record<Algo, Uint8Array>;
    post({ id, type: "done", digests });
  } catch (e) {
    post({ id, type: "error", error: String((e as Error)?.message ?? e) });
  }
};
