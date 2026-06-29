"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toPaisas } from "@/lib/utils";
import { ActionResult } from "@/types";

export async function getPlanners() {
  const userId = await getUserId();
  return prisma.planner.findMany({
    where: { userId },
    include: { items: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPlanner(id: string) {
  const userId = await getUserId();
  return prisma.planner.findFirst({
    where: { id, userId },
    include: {
      items: {
        orderBy: [{ eventGroup: "asc" }, { dueDate: "asc" }],
      },
    },
  });
}

export async function createPlanner(data: {
  name: string;
  description?: string;
  icon: string;
  coverColor: string;
  type?: string;
  targetDate?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.planner.create({
      data: {
        ...data,
        type: data.type ?? "GENERAL",
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        userId,
      },
    });
    revalidatePath("/planner");
    return { success: true };
  } catch (e) {
    console.error("[createPlanner]", e);
    return { success: false, error: "Failed to create planner" };
  }
}

export async function updatePlannerStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.planner.updateMany({
      where: { id, userId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
    revalidatePath("/planner");
    revalidatePath(`/planner/${id}`);
    return { success: true };
  } catch (e) {
    console.error("[updatePlannerStatus]", e);
    return { success: false, error: "Failed to update status" };
  }
}

export async function updatePlanner(id: string, data: Partial<{
  name: string; description: string; status: string; estimatedTotalCost: number;
}>): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.planner.updateMany({
      where: { id, userId },
      data: {
        ...data,
        estimatedTotalCost: data.estimatedTotalCost !== undefined ? toPaisas(data.estimatedTotalCost) : undefined,
      },
    });
    revalidatePath("/planner");
    revalidatePath(`/planner/${id}`);
    return { success: true };
  } catch (e) {
    console.error("[updatePlanner]", e);
    return { success: false, error: "Failed to update planner" };
  }
}

export async function createPlannerItem(plannerId: string, data: {
  name: string;
  description?: string;
  estimatedCost: number;
  dueDate?: string;
  notes?: string;
  eventGroup?: string;
  vendor?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const planner = await prisma.planner.findFirst({ where: { id: plannerId, userId } });
    if (!planner) return { success: false, error: "Not found" };

    await prisma.plannerItem.create({
      data: {
        ...data,
        estimatedCost: toPaisas(data.estimatedCost),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        plannerId,
      },
    });
    revalidatePath(`/planner/${plannerId}`);
    return { success: true };
  } catch (e) {
    console.error("[createPlannerItem]", e);
    return { success: false, error: "Failed to add item" };
  }
}

export async function updatePlannerItem(id: string, data: Partial<{
  name: string; status: string; actualCost: number; notes: string; vendor: string; eventGroup: string;
}>): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const item = await prisma.plannerItem.findFirst({
      where: { id },
      select: { planner: { select: { userId: true } } },
    });
    if (!item || item.planner.userId !== userId) return { success: false, error: "Not found" };

    await prisma.plannerItem.update({
      where: { id },
      data: {
        ...data,
        actualCost: data.actualCost !== undefined ? toPaisas(data.actualCost) : undefined,
      },
    });
    return { success: true };
  } catch (e) {
    console.error("[updatePlannerItem]", e);
    return { success: false, error: "Failed to update item" };
  }
}

export async function deletePlannerItem(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const item = await prisma.plannerItem.findFirst({
      where: { id },
      select: { planner: { select: { userId: true } } },
    });
    if (!item || item.planner.userId !== userId) return { success: false, error: "Not found" };

    await prisma.plannerItem.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    console.error("[deletePlannerItem]", e);
    return { success: false, error: "Failed to delete item" };
  }
}

export async function deletePlanner(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.planner.deleteMany({ where: { id, userId } });
    revalidatePath("/planner");
    return { success: true };
  } catch (e) {
    console.error("[deletePlanner]", e);
    return { success: false, error: "Failed to delete planner" };
  }
}
