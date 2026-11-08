const ALGO = "AES-GCM";
const MARK = "aes256gcm.";
const KEY_NAME = "omerta_aes_key";

function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function b64ToBytes(value: string) {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function vaultKey() {
  let stored = localStorage.getItem(KEY_NAME);
  if (!stored) {
    const fresh = crypto.getRandomValues(new Uint8Array(32));
    stored = bytesToB64(fresh);
    localStorage.setItem(KEY_NAME, stored);
  }
  return crypto.subtle.importKey("raw", b64ToBytes(stored), { name: ALGO }, false, ["encrypt", "decrypt"]);
}

export async function sealBytes(plain: BufferSource) {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: ALGO, iv }, key, plain);
  return { iv: iv.buffer, data };
}

export async function openBytes(iv: ArrayBuffer, data: ArrayBuffer) {
  const key = await vaultKey();
  return crypto.subtle.decrypt({ name: ALGO, iv: new Uint8Array(iv) }, key, data);
}

export async function sealVault(plain: string) {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, key, new TextEncoder().encode(plain)));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return MARK + bytesToB64(packed);
}

export async function openVault(payload: string) {
  if (!payload.startsWith(MARK)) return payload;
  const packed = b64ToBytes(payload.slice(MARK.length));
  const key = await vaultKey();
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: packed.subarray(0, 12) },
    key,
    packed.subarray(12),
  );
  return new TextDecoder().decode(plain);
}

export function isSealed(payload: string) {
  return payload.startsWith(MARK);
}
