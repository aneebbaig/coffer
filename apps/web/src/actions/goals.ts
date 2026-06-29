"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toPaisas } from "@/lib/utils";
import { ActionResult, GoalItem } from "@/types";

export async function getGoals() {
  const userId = await getUserId();
  return prisma.goal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "desc" }],
  });
}

export async function reorderGoals(updates: { id: string; order: number }[]): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.$transaction(
      updates.map(({ id, order }) => prisma.goal.update({ where: { id, userId }, data: { order } }))
    );
    revalidatePath("/goals");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to reorder goals" };
  }
}

export async function getGoal(id: string) {
  const userId = await getUserId();
  return prisma.goal.findFirst({ where: { id, userId } });
}

export async function createGoal(data: {
  name: string;
  description?: string;
  icon: string;
  color: string;
  goalType: string;
  targetAmount: number;
  deadline?: string;
  priority: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.goal.create({
      data: {
        ...data,
        targetAmount: data.goalType === "ITEMS" ? 0 : toPaisas(data.targetAmount),
        deadline: data.deadline ? new Date(data.deadline) : null,
        userId,
      },
    });
    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[createGoal]", e);
    return { success: false, error: "Failed to create goal" };
  }
}

export async function updateGoal(id: string, data: {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  targetAmount?: number;
  deadline?: string;
  priority?: string;
  status?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) return { success: false, error: "Not found" };

    await prisma.goal.update({
      where: { id },
      data: {
        ...data,
        targetAmount: data.targetAmount ? toPaisas(data.targetAmount) : undefined,
        deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
      },
    });
    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[updateGoal]", e);
    return { success: false, error: "Failed to update goal" };
  }
}

export async function addMoneyToGoal(id: string, amount: number): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) return { success: false, error: "Not found" };

    const amountInPaisas = Math.round(amount * 100);
    const newSaved = goal.savedAmount + amountInPaisas;
    const newStatus = newSaved >= goal.targetAmount ? "COMPLETED" : goal.status;

    await prisma.goal.update({
      where: { id },
      data: { savedAmount: newSaved, status: newStatus },
    });
    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[addMoneyToGoal]", e);
    return { success: false, error: "Failed to add money" };
  }
}

export async function updateGoalItems(id: string, items: GoalItem[]): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) return { success: false, error: "Not found" };

    const updateData: Record<string, unknown> = { items: JSON.stringify(items) };
    if (existing.goalType === "ITEMS") {
      updateData.targetAmount = items.reduce((sum, i) => sum + i.estimatedCost, 0);
    }

    await prisma.goal.update({ where: { id }, data: updateData });
    revalidatePath(`/goals/${id}`);
    return { success: true };
  } catch (e) {
    console.error("[updateGoalItems]", e);
    return { success: false, error: "Failed to update items" };
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.goal.deleteMany({ where: { id, userId } });
    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[deleteGoal]", e);
    return { success: false, error: "Failed to delete goal" };
  }
}
