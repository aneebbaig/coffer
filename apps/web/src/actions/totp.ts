"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { getServerUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { generateTotpSecret, buildTotpUri, verifyTotp, generateBackupCodes } from "@/lib/totp";
import { ActionResult } from "@/types";

async function requireUser(): Promise<{ id: string; email: string }> {
  const u = await getServerUser();
  if (!u) throw new Error("Unauthorized");
  return { id: u.id, email: u.email };
}

export async function getTotpStatus(): Promise<{ enabled: boolean }> {
  const u = await getServerUser();
  if (!u) throw new Error("Unauthorized");
  const rec = await prisma.user.findUnique({ where: { id: u.id }, select: { totpEnabled: true } });
  return { enabled: !!rec?.totpEnabled };
}

// Generate a pending secret, store it encrypted (enabled stays false until a
// code is confirmed), and return the QR + manual key for the authenticator.
export async function startTotpEnroll(): Promise<{ qrDataUrl: string; secret: string } | { error: string }> {
  try {
    const { id, email } = await requireUser();
    const existing = await prisma.user.findUnique({ where: { id }, select: { totpEnabled: true } });
    if (existing?.totpEnabled) return { error: "2FA is already enabled" };
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id }, data: { totpSecret: encryptSecret(secret), totpEnabled: false } });
    const qrDataUrl = await QRCode.toDataURL(buildTotpUri(email, secret));
    return { qrDataUrl, secret };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to start enrollment" };
  }
}

// Verify the first code, flip 2FA on, and return one-time backup codes.
export async function confirmTotpEnroll(code: string): Promise<{ backupCodes: string[] } | { error: string }> {
  try {
    const { id } = await requireUser();
    const rec = await prisma.user.findUnique({ where: { id }, select: { totpSecret: true, totpEnabled: true } });
    if (!rec?.totpSecret) return { error: "Start enrollment first" };
    if (rec.totpEnabled) return { error: "2FA is already enabled" };
    if (!verifyTotp(decryptSecret(rec.totpSecret), code)) return { error: "Invalid code — try again" };
    const { plain, hashed } = await generateBackupCodes();
    await prisma.user.update({ where: { id }, data: { totpEnabled: true, totpBackupCodes: hashed } });
    revalidatePath("/settings");
    return { backupCodes: plain };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to confirm" };
  }
}

// Disable 2FA — requires the current password so a hijacked session cannot
// silently turn it off.
export async function disableTotp(password: string): Promise<ActionResult> {
  try {
    const { id } = await requireUser();
    const rec = await prisma.user.findUnique({ where: { id }, select: { hashedPassword: true } });
    if (!rec) return { success: false, error: "Unauthorized" };
    if (!(await bcrypt.compare(password, rec.hashedPassword))) return { success: false, error: "Wrong password" };
    await prisma.user.update({
      where: { id },
      data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to disable" };
  }
}
