import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const pots = await prisma.savingsPot.findMany({
      where: { userId: auth.id },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        type: true,
        targetAmount: true,
        currentAmount: true,
        currentAmountUsd: true,
      },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    const totalPaisas = pots.reduce((s, p) => s + p.currentAmount, 0);

    return NextResponse.json({
      data: {
        pots,
        totalPaisas,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
