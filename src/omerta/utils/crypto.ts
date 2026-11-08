// End-to-End Encryption using Web Crypto API
// All messages are encrypted client-side before sending
// Server only sees ciphertext - cannot read content

const ALGO = 'AES-GCM';
const KEY_LEN = 256;
const IV_LEN = 12;

interface EncryptedPayload {
  iv: string;       // base64
  ciphertext: string; // base64
  senderPublicKey: string; // base64 JWK
  recipientPublicKey: string;
}

// --- KEY MANAGEMENT ---

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return btoa(JSON.stringify(jwk));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(b64));
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return btoa(JSON.stringify(jwk));
}

export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(b64));
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
}

// --- KEY EXCHANGE ---

async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: ALGO, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- ENCRYPT / DECRYPT ---

export async function encryptMessage(plaintext: string, myPrivateKey: CryptoKey, senderPublicKey: string, recipientPublicKey: CryptoKey): Promise<EncryptedPayload> {
  const sharedKey = await deriveSharedKey(myPrivateKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    sharedKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encrypted),
    senderPublicKey,
    recipientPublicKey: await exportPublicKey(recipientPublicKey),
  };
}

export async function decryptMessage(payload: EncryptedPayload, myPrivateKey: CryptoKey, myPublicKey: string): Promise<string> {
  const other = payload.senderPublicKey === myPublicKey ? payload.recipientPublicKey : payload.senderPublicKey;
  const sharedKey = await deriveSharedKey(myPrivateKey, await importPublicKey(other));
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv: base64ToArrayBuffer(payload.iv) },
    sharedKey,
    base64ToArrayBuffer(payload.ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

// --- STORAGE ---

export function getStoredKeyPair(): { publicKey: string; privateKey: string } | null {
  const pub = localStorage.getItem('omerta_e2e_public');
  const priv = localStorage.getItem('omerta_e2e_private');
  if (!pub || !priv) return null;
  return { publicKey: pub, privateKey: priv };
}

export function storeKeyPair(pub: string, priv: string) {
  localStorage.setItem('omerta_e2e_public', pub);
  localStorage.setItem('omerta_e2e_private', priv);
}

export async function initE2E(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = getStoredKeyPair();
  if (existing) return existing;

  const kp = await generateKeyPair();
  const pub = await exportPublicKey(kp.publicKey);
  const priv = await exportPrivateKey(kp.privateKey);
  storeKeyPair(pub, priv);
  return { publicKey: pub, privateKey: priv };
}

export async function openPrivate(payload: EncryptedPayload, myPrivateKey: CryptoKey, myPublicKey: string): Promise<{ body: string; reply: string }> {
  const text = await decryptMessage(payload, myPrivateKey, myPublicKey);
  try {
    const packed = JSON.parse(text) as { body?: string; reply?: string };
    if (packed && typeof packed.body === "string") return { body: packed.body, reply: packed.reply || "" };
  } catch { /* a sealed message can be plain text */ }
  return { body: text, reply: "" };
}

// --- UTILS ---

function arrayBufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptForRoom(plaintext: string, roomKey: string): Promise<{ iv: string; ciphertext: string }> {
  // Room encryption: single symmetric key shared among room members
  const keyData = base64ToArrayBuffer(roomKey);
  const key = await crypto.subtle.importKey('raw', keyData, { name: ALGO }, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: arrayBufferToBase64(iv), ciphertext: arrayBufferToBase64(encrypted) };
}

export async function decryptForRoom(payload: { iv: string; ciphertext: string }, roomKey: string): Promise<string> {
  const keyData = base64ToArrayBuffer(roomKey);
  const key = await crypto.subtle.importKey('raw', keyData, { name: ALGO }, false, ['encrypt', 'decrypt']);
  const iv = base64ToArrayBuffer(payload.iv);
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
