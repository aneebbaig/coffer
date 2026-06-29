import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

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
