import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";
import { computeFinancialPosition } from "@/lib/financial-position";

// A plan with its item checklist + an affordability snapshot (plan cost vs the
// user's liquid money), so mobile can show "can you cover it?" like web.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  try {
    const [plan, position] = await Promise.all([
      prisma.plan.findFirst({
        where: { id, userId: auth.id },
        include: { items: { orderBy: { status: "asc" } } },
      }),
      computeFinancialPosition(auth.id),
    ]);
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalEstimated = plan.items.reduce((s, i) => s + i.estimatedCost, 0);
    const totalPaid = plan.items.reduce(
      (s, i) => s + (i.actualCost ?? (i.status === "PAID" ? i.estimatedCost : 0)),
      0,
    );
    const total = plan.planType === "FIXED" ? plan.estimatedTotalCost : totalEstimated;
    const remaining = total - totalPaid;

    return NextResponse.json({
      data: {
        id: plan.id,
        name: plan.name,
        icon: plan.icon,
        coverColor: plan.coverColor,
        planType: plan.planType,
        status: plan.status,
        targetDate: plan.targetDate ? plan.targetDate.toISOString() : null,
        totalEstimatedPaisas: total,
        totalPaidPaisas: totalPaid,
        remainingPaisas: remaining,
        items: plan.items.map((i) => ({
          id: i.id,
          name: i.name,
          estimatedCostPaisas: i.estimatedCost,
          actualCostPaisas: i.actualCost,
          status: i.status,
          notes: i.notes,
          vendor: i.vendor,
          dueDate: i.dueDate ? i.dueDate.toISOString() : null,
        })),
        affordability: {
          liquidAvailablePaisas: position.liquidAvailable,
          investmentsTotalPaisas: position.investmentsTotal,
          netWorthPaisas: position.netWorth,
          // 0-100, clamped: negative liquid = 0% covered.
          coveragePct: remaining > 0
            ? Math.max(0, Math.min(100, Math.round((position.liquidAvailable / remaining) * 100)))
            : 100,
          canAfford: position.liquidAvailable >= remaining,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
