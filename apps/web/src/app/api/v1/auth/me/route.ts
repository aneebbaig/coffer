import { NextRequest, NextResponse } from "next/server";
import { requireBearerAuth } from "@/lib/v1-auth";

export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    data: {
      id: auth.id,
      name: auth.name,
      email: auth.email,
      role: auth.role,
    },
  });
}
