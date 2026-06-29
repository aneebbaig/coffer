import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/tokens";

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

    return NextResponse.json({
      data: {
        accessToken,
        refreshToken,
        user: payload,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
