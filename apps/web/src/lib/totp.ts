import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const ISSUER = "Coffer";

// A fresh base32 secret for a new enrollment.
export function generateTotpSecret(): string {
  return new OTPAuth.Secret().base32;
}

function buildTotp(email: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

// otpauth:// URI for the QR code / manual entry in an authenticator app.
export function buildTotpUri(email: string, secretBase32: string): string {
  return buildTotp(email, secretBase32).toString();
}

// Verify a 6-digit code. window:1 tolerates one period of clock drift.
export function verifyTotp(secretBase32: string, token: string): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return buildTotp("", secretBase32).validate({ token: clean, window: 1 }) !== null;
}

// One-time recovery codes. Returns plaintext (shown once) + bcrypt hashes
// (persisted). Format 8 hex chars, easy to type.
export async function generateBackupCodes(count = 10): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: count }, () => randomBytes(4).toString("hex"));
  const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashed };
}

// Check a submitted backup code against the stored hashes. Returns the
// remaining hashes (with the matched one removed) or null if no match.
export async function consumeBackupCode(
  submitted: string,
  hashes: string[],
): Promise<string[] | null> {
  const clean = submitted.replace(/\s/g, "").toLowerCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(clean, hashes[i])) {
      return [...hashes.slice(0, i), ...hashes.slice(i + 1)];
    }
  }
  return null;
}
