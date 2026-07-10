import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

// The target-allocation plan (one per user): a monthly target split across
// editable categories. Also returned inside GET /investments, but exposed
// standalone so mobile can edit it directly.
export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const plan = await prisma.investmentPlan.findUnique({
      where: { userId: auth.id },
      include: { categories: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({
      data: plan
        ? {
            id: plan.id,
            monthlyTargetPaisas: plan.monthlyTarget,
            autoFromSurplus: plan.autoFromSurplus,
            categories: plan.categories.map((c) => ({
              id: c.id,
              name: c.name,
              investmentType: c.investmentType,
              percentage: c.percentage,
            })),
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const putSchema = z.object({
  monthlyTargetPaisas: z.number().int().nonnegative().optional(),
  autoFromSurplus: z.boolean().optional(),
  categories: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        investmentType: z.string().nullable().optional(),
        percentage: z.number().int().min(0).max(100),
      }),
    )
    .max(20),
});

export async function PUT(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const d = parsed.data;

    const totalPct = d.categories.reduce((s, c) => s + c.percentage, 0);
    if (d.categories.length > 0 && totalPct !== 100) {
      return NextResponse.json({ error: `Category split must total 100% (currently ${totalPct}%)` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const plan = await tx.investmentPlan.upsert({
        where: { userId: auth.id },
        create: {
          userId: auth.id,
          monthlyTarget: d.monthlyTargetPaisas ?? 0,
          autoFromSurplus: d.autoFromSurplus ?? true,
        },
        update: {
          ...(d.monthlyTargetPaisas != null && { monthlyTarget: d.monthlyTargetPaisas }),
          ...(d.autoFromSurplus != null && { autoFromSurplus: d.autoFromSurplus }),
        },
      });
      // Full replace — the split is a handful of rows edited as a whole.
      await tx.investmentPlanCategory.deleteMany({ where: { planId: plan.id } });
      if (d.categories.length > 0) {
        await tx.investmentPlanCategory.createMany({
          data: d.categories.map((c, i) => ({
            planId: plan.id,
            name: c.name,
            investmentType: c.investmentType ?? null,
            percentage: c.percentage,
            order: i,
          })),
        });
      }
    });

    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
