import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token required" }, { status: 401 });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const tokenPayload = { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    return NextResponse.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
