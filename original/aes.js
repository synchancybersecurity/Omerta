import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const KEY_PATH = fileURLToPath(new URL("./omerta.aes", import.meta.url));

function vaultKey() {
  const fromEnv = process.env.OMERTA_AES_KEY;
  if (fromEnv) {
    const raw = Buffer.from(fromEnv, "utf8");
    return raw.length === 32 ? raw : createHash("sha256").update(raw).digest();
  }
  if (!existsSync(KEY_PATH)) writeFileSync(KEY_PATH, randomBytes(32));
  const key = readFileSync(KEY_PATH);
  if (key.length !== 32) throw new Error("AES key must be 32 bytes");
  return key;
}

export function seal(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("OM1"), iv, tag, enc]).toString("base64");
}

export function open(payload) {
  const raw = String(payload);
  if (raw.trim().startsWith("{")) return raw;
  const buf = Buffer.from(raw.trim(), "base64");
  if (buf.subarray(0, 3).toString() !== "OM1") return raw;
  const iv = buf.subarray(3, 15);
  const tag = buf.subarray(15, 31);
  const enc = buf.subarray(31);
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function readStore(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(open(readFileSync(path, "utf8")));
}

export function writeStore(path, data) {
  writeFileSync(path, seal(JSON.stringify(data)));
}
