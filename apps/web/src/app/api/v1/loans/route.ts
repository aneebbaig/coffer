import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

export async function GET(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const loans = await prisma.loan.findMany({
      where: { userId: auth.id },
      select: {
        id: true,
        personName: true,
        description: true,
        type: true,
        principalAmount: true,
        remainingAmount: true,
        date: true,
        dueDate: true,
        status: true,
        notes: true,
        payments: {
          select: { id: true, amount: true, date: true, notes: true },
          orderBy: { date: "desc" },
          take: 5,
        },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      data: loans.map((l) => ({
        ...l,
        date: l.date.toISOString(),
        dueDate: l.dueDate?.toISOString() ?? null,
        payments: l.payments.map((p) => ({
          ...p,
          date: p.date.toISOString(),
        })),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST /api/v1/loans ────────────────────────────────────────────────────────

const createLoanSchema = z.object({
  personName: z.string().min(1).max(100),
  type: z.enum(["GIVEN", "RECEIVED"]),
  principalPaisas: z.number().int().positive(),
  description: z.string().max(200).optional(),
  date: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = createLoanSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { personName, type, principalPaisas, description, date, dueDate, notes } = parsed.data;

    const created = await prisma.loan.create({
      data: {
        personName,
        type,
        principalAmount: principalPaisas,
        remainingAmount: principalPaisas,
        description: description ?? null,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes ?? null,
        userId: auth.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ data: { id: created.id } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
