import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from "@/lib/tokens";
import { isLocked, lockoutMinutesRemaining, recordFailedLogin, clearFailedLogins } from "@/lib/login-lockout";
import { checkLoginTotp } from "@/lib/totp-login";

export async function POST(req: NextRequest) {
  try {
    const { email, password, totp } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (isLocked(user)) {
      const minutes = lockoutMinutesRemaining(user);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 423 },
      );
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      await recordFailedLogin(user);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Second factor. Password was correct, so a missing code is not a failed
    // attempt (don't lock) - just ask the client for it. A wrong code counts.
    const totpResult = await checkLoginTotp(user, totp);
    if (totpResult === "required") {
      return NextResponse.json({ totpRequired: true }, { status: 200 });
    }
    if (totpResult === "invalid") {
      await recordFailedLogin(user);
      // 422 (not 401) so the form shows a bad-code error rather than a generic
      // credential failure.
      return NextResponse.json({ error: "Invalid authentication code" }, { status: 422 });
    }

    await clearFailedLogins(user.id);

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(payload),
      signRefreshToken(payload),
    ]);

    const isSecure = req.url.startsWith("https://");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(isSecure, 15 * 60));
    res.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(isSecure, 7 * 24 * 60 * 60));
    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
