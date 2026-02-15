import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) return null;
  const buf = Buffer.from(keyHex, "hex");
  if (buf.length !== 32) {
    console.warn("[Crypto] FIELD_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Encryption disabled.");
    return null;
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;
  try {
    const data = Buffer.from(ciphertext, "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH) return ciphertext;
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return ciphertext;
  }
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return value as null;
  return encrypt(value);
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return value as null;
  return decrypt(value);
}
