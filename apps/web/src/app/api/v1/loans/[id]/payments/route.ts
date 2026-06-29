import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

const createPaymentSchema = z.object({
  amountPaisas: z.number().int().positive(),
  date: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: loanId } = await params;

  try {
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId: auth.id } });
    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    if (loan.status === "PAID") return NextResponse.json({ error: "Loan already paid" }, { status: 422 });

    const body = await req.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { amountPaisas, date, notes } = parsed.data;
    if (amountPaisas > loan.remainingAmount) {
      return NextResponse.json({ error: "Payment exceeds remaining balance" }, { status: 422 });
    }

    const newRemaining = loan.remainingAmount - amountPaisas;
    const newStatus = newRemaining === 0 ? "PAID" : "PARTIALLY_PAID";

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.loanPayment.create({
        data: { loanId, amount: amountPaisas, date: new Date(date), notes: notes ?? null },
        select: { id: true },
      });
      await tx.loan.update({
        where: { id: loanId },
        data: { remainingAmount: newRemaining, status: newStatus },
      });
      return p;
    });

    return NextResponse.json({ data: { id: payment.id } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
