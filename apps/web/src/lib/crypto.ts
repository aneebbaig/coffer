import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// AES-256-GCM encryption for secrets that must be recoverable (TOTP seeds).
// The key is derived from TOTP_ENC_KEY so any sufficiently long passphrase
// works; we SHA-256 it to a fixed 32-byte key. Ciphertext format is
// iv:authTag:data, all hex, so a single string round-trips through a
// nullable DB column.

function getKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY;
  if (!raw || raw.length < 16) {
    throw new Error("TOTP_ENC_KEY is not set (need a random string, 16+ chars)");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
