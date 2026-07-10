import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

// Delete a logged contribution and decrement the SIP's cached total in one
// transaction, scoped to the owner.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id, cid } = await params;

  try {
    const ok = await prisma.$transaction(async (tx) => {
      const c = await tx.investmentContribution.findFirst({
        where: { id: cid, investmentId: id, investment: { userId: auth.id } },
        select: { id: true, amount: true },
      });
      if (!c) return false;
      await tx.investmentContribution.delete({ where: { id: cid } });
      await tx.investment.update({
        where: { id },
        data: { investedAmount: { decrement: c.amount } },
      });
      return true;
    });

    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { id: cid } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
