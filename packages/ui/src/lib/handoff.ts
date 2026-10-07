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

export async function stashFiles(files: File[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(files, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Returns stashed files (and clears them), or an empty array. */
export async function takeFiles(): Promise<File[]> {
  try {
    const db = await open();
    const files = await new Promise<File[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onsuccess = () => {
        store.delete(KEY);
        resolve((req.result as File[] | undefined) ?? []);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return files;
  } catch {
    return [];
  }
}
