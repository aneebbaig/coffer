"use server";

import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toPaisas } from "@/lib/utils";
import { ActionResult, GoalItem } from "@/types";
import { createTransaction } from "@/actions/expenses";

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

async function findOrCreateGoalPurchaseCategory(userId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId, name: "Goal Purchase", type: "EXPENSE" },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { userId, name: "Goal Purchase", type: "EXPENSE", color: "#8b5cf6", icon: "🎯" },
  });
  return created.id;
}

/**
 * One-tap expense logging for a milestone item, shown inline right after it's
 * marked purchased - no dialog, no category picker. Reuses createTransaction
 * so it gets the same income-availability check and notifications as any
 * other expense; auto-provisions a "Goal Purchase" category to keep it a
 * single click.
 */
export async function logGoalItemExpense(goalId: string, itemId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) return { success: false, error: "Not found" };

    let items: GoalItem[];
    try { items = JSON.parse(goal.items); } catch { items = []; }
    const item = items.find((i) => i.id === itemId);
    if (!item) return { success: false, error: "Item not found" };
    if (item.expenseLogged) return { success: false, error: "Expense already logged for this item" };

    const amountPaisas = item.actualCost ?? item.estimatedCost;
    if (!amountPaisas || amountPaisas <= 0) return { success: false, error: "Set a cost for this item first" };

    const categoryId = await findOrCreateGoalPurchaseCategory(userId);
    const result = await createTransaction({
      amount: amountPaisas / 100,
      type: "EXPENSE",
      categoryId,
      description: item.name,
      date: new Date().toISOString().slice(0, 10),
      isRecurring: false,
      tags: "",
      fundingSource: "INCOME",
    });
    if (!result.success) return result;

    const updatedItems = items.map((i) => (i.id === itemId ? { ...i, expenseLogged: true } : i));
    await prisma.goal.update({ where: { id: goalId }, data: { items: JSON.stringify(updatedItems) } });
    revalidatePath(`/goals/${goalId}`);
    return { success: true };
  } catch (e) {
    console.error("[logGoalItemExpense]", e);
    return { success: false, error: "Failed to log expense" };
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
