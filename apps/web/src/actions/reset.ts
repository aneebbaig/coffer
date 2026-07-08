"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ActionResult } from "@/types";
import { RESET_GROUP_KEYS, ResetGroupKey } from "@/lib/reset-groups";

async function requireSuperAdmin(): Promise<void> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "SUPER_ADMIN") throw new Error("Forbidden");
}

// Deletion order matters for exactly one reason: Transaction.categoryId and
// BudgetCategory.categoryId hold required (ON DELETE RESTRICT) foreign keys
// to Category. Every other relation in the schema is either owned-and-cascading
// or an optional FK that gets SET NULL, so it self-resolves regardless of
// which groups are picked or in what order. Categories must go last so the
// transactions/budgets that reference them are already gone.
const DELETE_ORDER: ResetGroupKey[] = [
  "transactions",
  "budgets",
  "savingsPots",
  "goals",
  "investments",
  "loans",
  "planners",
  "wedding",
  "lists",
  "tasks",
  "projects",
  "calendar",
  "vault",
  "perfumes",
  "categories",
];

export async function resetAppData(
  keys: string[],
): Promise<ActionResult<Record<string, number>>> {
  try {
    await requireSuperAdmin();

    const validKeys = new Set<string>(RESET_GROUP_KEYS);
    const selected = new Set(keys.filter((k) => validKeys.has(k)));
    if (selected.size === 0) {
      return { success: false, error: "Select at least one thing to reset" };
    }

    const ordered = DELETE_ORDER.filter((k) => selected.has(k));
    const deleted: Record<string, number> = {};

    await prisma.$transaction(
      async (tx) => {
        for (const key of ordered) {
          switch (key) {
            case "transactions": {
              const r = await tx.transaction.deleteMany({});
              deleted.transactions = r.count;
              break;
            }
            case "budgets": {
              const r = await tx.budget.deleteMany({});
              deleted.budgets = r.count;
              break;
            }
            case "savingsPots": {
              const r = await tx.savingsPot.deleteMany({});
              deleted.savingsPots = r.count;
              break;
            }
            case "goals": {
              const r = await tx.goal.deleteMany({});
              deleted.goals = r.count;
              break;
            }
            case "investments": {
              const r = await tx.investment.deleteMany({});
              deleted.investments = r.count;
              break;
            }
            case "loans": {
              // Loan.transactionId is required - each loan's principal is a real
              // ledger transaction. Deleting the loan wrapper doesn't touch it
              // automatically (the cascade only runs the other direction), so
              // clear those transactions too. No-op if "transactions" already
              // ran above and cascaded these loans away.
              const loans = await tx.loan.findMany({ select: { transactionId: true } });
              const r = await tx.loan.deleteMany({});
              if (loans.length > 0) {
                await tx.transaction.deleteMany({ where: { id: { in: loans.map((l) => l.transactionId) } } });
              }
              deleted.loans = r.count;
              break;
            }
            case "planners": {
              const r = await tx.planner.deleteMany({});
              deleted.planners = r.count;
              break;
            }
            case "wedding": {
              const r = await tx.weddingPlan.deleteMany({});
              deleted.wedding = r.count;
              break;
            }
            case "lists": {
              const w = await tx.wantListItem.deleteMany({});
              const n = await tx.needListItem.deleteMany({});
              deleted.lists = w.count + n.count;
              break;
            }
            case "tasks": {
              const r = await tx.task.deleteMany({});
              deleted.tasks = r.count;
              break;
            }
            case "projects": {
              const r = await tx.project.deleteMany({});
              deleted.projects = r.count;
              break;
            }
            case "calendar": {
              const r = await tx.calendarEvent.deleteMany({});
              deleted.calendar = r.count;
              break;
            }
            case "vault": {
              const r = await tx.surprise.deleteMany({});
              deleted.vault = r.count;
              break;
            }
            case "perfumes": {
              const r = await tx.perfume.deleteMany({});
              deleted.perfumes = r.count;
              break;
            }
            case "categories": {
              // Custom (userId != null) categories only - built-in categories
              // are shared and never touched. A category can only be hard-deleted
              // once nothing still references it (RESTRICT); check first rather
              // than delete-and-catch, since a failed statement would poison the
              // rest of this transaction. Anything still referenced gets hidden
              // instead, same fallback the regular "delete category" action uses.
              const custom = await tx.category.findMany({
                where: { userId: { not: null } },
                select: { id: true },
              });
              let removed = 0;
              let hidden = 0;
              for (const c of custom) {
                const [txCount, budgetCount] = await Promise.all([
                  tx.transaction.count({ where: { categoryId: c.id } }),
                  tx.budgetCategory.count({ where: { categoryId: c.id } }),
                ]);
                if (txCount === 0 && budgetCount === 0) {
                  await tx.category.delete({ where: { id: c.id } });
                  removed++;
                } else {
                  await tx.category.update({ where: { id: c.id }, data: { isHidden: true } });
                  hidden++;
                }
              }
              deleted.categories = removed;
              if (hidden > 0) deleted.categoriesHidden = hidden;
              break;
            }
          }
        }
      },
      { timeout: 30000 },
    );

    revalidatePath("/", "layout");
    return { success: true, data: deleted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reset data";
    return { success: false, error: msg };
  }
}
