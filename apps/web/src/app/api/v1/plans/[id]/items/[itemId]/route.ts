import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBearerAuth } from "@/lib/v1-auth";

// Update a plan item's status — used for "undo" (back to PENDING). Booking an
// expense goes through the /buy sub-route.
const patchSchema = z.object({
  status: z.enum(["PENDING", "BOOKED", "PAID", "SKIPPED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireBearerAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id, itemId } = await params;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    const updated = await prisma.planItem.updateMany({
      where: { id: itemId, planId: id, plan: { userId: auth.id } },
      // Un-marking an item (back to PENDING) clears its recorded actual cost so
      // it no longer reads as "paid".
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "PENDING" ? { actualCost: null } : {}),
      },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { id: itemId } });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
