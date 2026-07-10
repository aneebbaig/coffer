import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

// Plans (formerly Planner) for the Flutter client. A plan is a project you work
// toward — FIXED (one target cost) or ITEMIZED (a checklist you buy over time).
// Amounts are paisas.
export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const plans = await prisma.plan.findMany({
      where: { userId: auth.id },
      include: { items: { select: { estimatedCost: true, actualCost: true, status: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      data: plans.map((p) => {
        const totalEstimated = p.items.reduce((s, i) => s + i.estimatedCost, 0);
        const totalPaid = p.items.reduce(
          (s, i) => s + (i.actualCost ?? (i.status === "PAID" ? i.estimatedCost : 0)),
          0,
        );
        const paidCount = p.items.filter((i) => i.status === "PAID").length;
        return {
          id: p.id,
          name: p.name,
          icon: p.icon,
          coverColor: p.coverColor,
          planType: p.planType,
          status: p.status,
          targetDate: p.targetDate ? p.targetDate.toISOString() : null,
          // FIXED plans carry the target directly; ITEMIZED derive it from items.
          totalEstimatedPaisas: p.planType === "FIXED" ? p.estimatedTotalCost : totalEstimated,
          totalPaidPaisas: totalPaid,
          itemCount: p.items.length,
          paidCount,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
