import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LockoutUser {
  id: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export function isLocked(user: LockoutUser): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
}

export function lockoutMinutesRemaining(user: LockoutUser): number {
  if (!user.lockedUntil) return 0;
  return Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
}

// Increments the failed-attempt counter and locks the account once it hits
// the threshold. DB-backed (not in-memory) so it holds up across Vercel's
// stateless serverless invocations.
export async function recordFailedLogin(user: LockoutUser): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  await prisma.user.update({
    where: { id: user.id },
    data:
      attempts >= MAX_ATTEMPTS
        ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }
        : { failedLoginAttempts: attempts },
  });
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
