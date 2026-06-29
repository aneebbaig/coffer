import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type TokenPayload } from "./tokens";

/** Extract and verify Bearer token from Authorization header. */
export async function requireBearerAuth(
  req: NextRequest,
): Promise<TokenPayload | NextResponse> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await verifyAccessToken(auth.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return payload;
}
