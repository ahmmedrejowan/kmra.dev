/**
 * Pass files from one page to another on the same subdomain (e.g. landing-page drop → tool page)
 * without uploading anything. Files are kept in IndexedDB and removed when read.
 */
const DB = "kmra-handoff";
const STORE = "files";
const KEY = "pending";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Files left waiting longer than this (the user went elsewhere) aren't opened later by surprise */
const FRESH_MS = 3 * 60_000;

/** The page part of an address: "/bn/compress" from "https://x/bn/compress?a#b" */
const pathOf = (url: string) => new URL(url, location.href).pathname;

/** A file as plain bytes, for browsers that can't keep a File in IndexedDB */
interface Bytes {
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
}

async function put(db: IDBDatabase, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

/**
 * Keep files for the next page. `to` is the address they're meant for: only that page takes
 * them (another tool of the app opened later won't), and only for a few minutes.
 */
export async function stashFiles(files: File[], to?: string): Promise<void> {
  const db = await open();
  const meta = { to: to ? pathOf(to) : null, at: Date.now() };
  try {
    await put(db, { files, ...meta });
  } catch {
    // Safari's private windows (and WebKit's test browser) can't store a File: keep the bytes
    const bytes: Bytes[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        type: f.type,
        lastModified: f.lastModified,
        data: await f.arrayBuffer(),
      })),
    );
    await put(db, { files: bytes, ...meta });
  } finally {
    db.close();
  }
}

const asFile = (f: File | Bytes): File =>
  f instanceof Blob
    ? f
    : new File([f.data], f.name, {
        type: f.type,
        lastModified: f.lastModified,
      });

/** Stashed files meant for this page (and clears them), or an empty array. */
export async function takeFiles(): Promise<File[]> {
  try {
    const db = await open();
    const saved = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => {
        store.delete(KEY);
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!saved || Array.isArray(saved)) return [];
    const { files, to, at } = saved as {
      files: (File | Bytes)[];
      to: string | null;
      at: number;
    };
    if (Date.now() - at > FRESH_MS) return [];
    if (to && to !== location.pathname) return [];
    return files.map(asFile);
  } catch {
    return [];
  }
}
