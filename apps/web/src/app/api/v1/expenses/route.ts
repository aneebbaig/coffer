import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";
import { getCurrentPeriod } from "@/lib/month";
import { getBaseCurrency } from "@/lib/currency-helpers";

// ── GET /api/v1/expenses ──────────────────────────────────────────────────────

const querySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { currentBudgetMonth: true, currentBudgetYear: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const period = getCurrentPeriod(user.currentBudgetMonth, user.currentBudgetYear);
    const { page, limit } = parsed.data;
    const month = parsed.data.month ?? period.month;
    const year = parsed.data.year ?? period.year;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: auth.id, type: "EXPENSE", budgetMonth: month, budgetYear: year },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          description: true,
          notes: true,
          date: true,
          isRegretPurchase: true,
          category: { select: { id: true, name: true, icon: true, color: true } },
        },
      }),
      prisma.transaction.count({
        where: { userId: auth.id, type: "EXPENSE", budgetMonth: month, budgetYear: year },
      }),
    ]);

    return NextResponse.json({
      data: {
        items: items.map((t) => ({
          id: t.id,
          amountPaisas: t.amount,
          description: t.description,
          notes: t.notes ?? null,
          date: t.date.toISOString(),
          isRegretPurchase: t.isRegretPurchase,
          category: t.category,
        })),
        total,
        page,
        hasMore: skip + items.length < total,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST /api/v1/expenses ─────────────────────────────────────────────────────

const createExpenseSchema = z.object({
  amountPaisas: z.number().int().positive(),
  categoryId: z.string().min(1),
  description: z.string().min(1).max(200),
  notes: z.string().max(1000).optional(),
  date: z.string().min(1),
  isRegretPurchase: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { amountPaisas, categoryId, description, notes, date, isRegretPurchase } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { currentBudgetMonth: true, currentBudgetYear: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const period = getCurrentPeriod(user.currentBudgetMonth, user.currentBudgetYear);

    const [incomeAgg, expenseTxns] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: auth.id, type: "INCOME", budgetMonth: period.month, budgetYear: period.year },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { userId: auth.id, type: "EXPENSE", budgetMonth: period.month, budgetYear: period.year },
        select: { amount: true, fundingSource: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount ?? 0;
    const incomeFundedExpenses = expenseTxns
      .filter((t) => t.fundingSource !== "SAVINGS_POT")
      .reduce((sum, t) => sum + t.amount, 0);
    const available = totalIncome - incomeFundedExpenses;

    if (available < amountPaisas) {
      const base = await getBaseCurrency();
      const availableFmt = (available / 100).toLocaleString("en-PK");
      return NextResponse.json(
        { error: `Insufficient income. Available: ${base.symbol} ${availableFmt}` },
        { status: 422 },
      );
    }

    const created = await prisma.transaction.create({
      data: {
        amount: amountPaisas,
        type: "EXPENSE",
        categoryId,
        description,
        notes: notes ?? null,
        date: new Date(date),
        budgetMonth: period.month,
        budgetYear: period.year,
        isRecurring: false,
        tags: "",
        isRegretPurchase: isRegretPurchase ?? false,
        fundingSource: "INCOME",
        userId: auth.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ data: { id: created.id } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
