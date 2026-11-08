import { openBytes, sealBytes } from "@omerta/vault-aes";

const DB_NAME = "omerta-vault";
const STORE = "kv";
const FILES = "files";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function vaultGet(key: string) {
  const db = await openDb();
  return new Promise<string | null>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

export async function vaultSet(key: string, value: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function vaultDelete(key: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const USAGE_KEY = "file-usage";

type FileRec = { bytes: number; mime: string; iv: ArrayBuffer; data: ArrayBuffer };

export async function storeVaultFile(plain: ArrayBuffer, mime: string) {
  const used = Number(await vaultGet(USAGE_KEY)) || 0;
  const sealed = await sealBytes(plain);
  const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILES, "readwrite");
    tx.objectStore(FILES).put({ bytes: plain.byteLength, mime, iv: sealed.iv, data: sealed.data } satisfies FileRec, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await vaultSet(USAGE_KEY, String(used + plain.byteLength));
  return id;
}

export async function openVaultFile(id: string) {
  const db = await openDb();
  const rec = await new Promise<FileRec | null>((resolve, reject) => {
    const request = db.transaction(FILES, "readonly").objectStore(FILES).get(id);
    request.onsuccess = () => resolve((request.result as FileRec) || null);
    request.onerror = () => reject(request.error);
  });
  if (!rec) throw new Error("Missing file");
  const plain = await openBytes(rec.iv, rec.data);
  return new Blob([plain], { type: rec.mime || "application/octet-stream" });
}
