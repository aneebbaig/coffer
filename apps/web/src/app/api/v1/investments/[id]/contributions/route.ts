import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

// Log a top-up into a SIP, any amount, any time. Keeps the cached
// Investment.investedAmount total in sync in the same transaction.
const createSchema = z.object({
  amountPaisas: z.number().int().positive(),
  date: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const d = parsed.data;

    const contributionId = await prisma.$transaction(async (tx) => {
      const inv = await tx.investment.findFirst({ where: { id, userId: auth.id }, select: { id: true } });
      if (!inv) return null;
      const c = await tx.investmentContribution.create({
        data: { investmentId: id, amount: d.amountPaisas, date: new Date(d.date), notes: d.notes ?? null },
        select: { id: true },
      });
      await tx.investment.update({
        where: { id },
        data: { investedAmount: { increment: d.amountPaisas }, lastUpdated: new Date() },
      });
      return c.id;
    });

    if (!contributionId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { id: contributionId } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
