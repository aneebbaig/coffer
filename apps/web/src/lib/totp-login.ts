import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { verifyTotp, consumeBackupCode } from "@/lib/totp";

export type TotpLoginResult = "ok" | "required" | "invalid";

interface TotpUser {
  id: string;
  totpEnabled: boolean;
  totpSecret: string | null;
  totpBackupCodes: string[];
}

// Second factor gate, shared by the web and v1 (mobile) login routes. Call
// after the password check passes:
//   "ok"       -> issue tokens
//   "required" -> user has 2FA on but sent no code; ask the client for one
//   "invalid"  -> wrong code (caller should recordFailedLogin + reject)
// A valid backup code is consumed (removed) here.
export async function checkLoginTotp(
  user: TotpUser,
  submitted: string | undefined,
): Promise<TotpLoginResult> {
  if (!user.totpEnabled) return "ok";
  const code = (submitted ?? "").trim();
  if (!code) return "required";

  if (user.totpSecret) {
    try {
      if (verifyTotp(decryptSecret(user.totpSecret), code)) return "ok";
    } catch {
      // decrypt failure falls through to the backup-code path
    }
  }

  const remaining = await consumeBackupCode(code, user.totpBackupCodes);
  if (remaining) {
    await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: remaining } });
    return "ok";
  }

  return "invalid";
}
