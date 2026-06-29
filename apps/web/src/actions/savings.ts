"use server";

import { revalidatePath } from "next/cache";
import { getUserId, getAuthenticatedUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriod } from "@/lib/month";
import { toPaisas } from "@/lib/utils";
import { creditPot, debitPot } from "@/lib/pot-helpers";
import { ActionResult } from "@/types";

export async function getIncomeAvailableForPot(): Promise<{
  pkrAvailable: number;
  usdAvailable: number;
  totalIncome: number;
}> {
  const authUser = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
  const userId = authUser.id;
  const { month, year } = getCurrentPeriod(authUser.currentBudgetMonth as number | null, authUser.currentBudgetYear as number | null);

  const userPotIds = (await prisma.savingsPot.findMany({ where: { userId }, select: { id: true } })).map((p) => p.id);

  const [monthIncomeTx, incomeFundedExpenses, existingPotDeposits] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: "INCOME", budgetMonth: month, budgetYear: year },
      select: { amount: true, originalCurrency: true, originalAmount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "EXPENSE", fundingSource: "INCOME", budgetMonth: month, budgetYear: year },
      _sum: { amount: true },
    }),
    prisma.savingsPotEntry.findMany({
      where: { potId: { in: userPotIds }, sourceType: "INCOME", budgetMonth: month, budgetYear: year },
      select: { amount: true, amountUsd: true, currency: true },
    }),
  ]);

  const totalPkrIncome = monthIncomeTx.reduce((s, t) => s + t.amount, 0);
  const pkrExpenses = incomeFundedExpenses._sum.amount ?? 0;
  const pkrPotDeposits = existingPotDeposits.filter((e) => e.currency === "PKR").reduce((s, e) => s + e.amount, 0);
  const pkrAvailable = Math.max(0, totalPkrIncome - pkrExpenses - pkrPotDeposits);

  const totalUsdIncome = monthIncomeTx
    .filter((t) => t.originalCurrency === "USD")
    .reduce((s, t) => s + (t.originalAmount ?? 0), 0);
  const usdPotDeposits = existingPotDeposits.filter((e) => e.currency === "USD").reduce((s, e) => s + e.amountUsd, 0);
  const usdAvailable = Math.max(0, totalUsdIncome - usdPotDeposits);

  return { pkrAvailable, usdAvailable, totalIncome: totalPkrIncome };
}

export async function getSavingsPots() {
  const userId = await getUserId();
  return prisma.savingsPot.findMany({
    where: { userId },
    include: { linkedGoal: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createSavingsPot(data: {
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  type: string;
  linkedGoalId?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.savingsPot.create({
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        type: data.type,
        linkedGoalId: data.linkedGoalId,
        targetAmount: toPaisas(data.targetAmount),
        userId,
      },
    });
    revalidatePath("/savings");
    return { success: true };
  } catch (e) {
    console.error("[createSavingsPot]", e);
    return { success: false, error: "Failed to create savings pot" };
  }
}

export async function addMoneyToPot(
  potId: string,
  amount: number,
  currency: "PKR" | "USD" = "PKR",
  description?: string,
  sourceType: "INCOME" | "MANUAL" = "MANUAL"
): Promise<ActionResult> {
  try {
    const authUser = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
    const userId = authUser.id;
    const pot = await prisma.savingsPot.findFirst({ where: { id: potId, userId } });
    if (!pot) return { success: false, error: "Not found" };

    const amountInUnits = toPaisas(amount);
    const { month, year } = getCurrentPeriod(authUser.currentBudgetMonth as number | null, authUser.currentBudgetYear as number | null);

    if (sourceType === "INCOME") {
      const userPotIds = (await prisma.savingsPot.findMany({ where: { userId }, select: { id: true } })).map((p) => p.id);

      const [monthIncomeTx, incomeFundedExpenses, existingPotDeposits] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId, type: "INCOME", budgetMonth: month, budgetYear: year },
          select: { amount: true, originalCurrency: true, originalAmount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "EXPENSE", fundingSource: "INCOME", budgetMonth: month, budgetYear: year },
          _sum: { amount: true },
        }),
        prisma.savingsPotEntry.findMany({
          where: { potId: { in: userPotIds }, sourceType: "INCOME", budgetMonth: month, budgetYear: year },
          select: { amount: true, amountUsd: true, currency: true },
        }),
      ]);

      if (currency === "PKR") {
        const totalPkrIncome = monthIncomeTx.reduce((s, t) => s + t.amount, 0);
        const pkrExpenses = incomeFundedExpenses._sum.amount ?? 0;
        const pkrPotDeposits = existingPotDeposits.filter((e) => e.currency === "PKR").reduce((s, e) => s + e.amount, 0);
        const available = totalPkrIncome - pkrExpenses - pkrPotDeposits;
        if (available < amountInUnits) {
          return { success: false, error: `Insufficient income available this month: Rs ${(Math.max(0, available) / 100).toLocaleString()}` };
        }
      } else {
        const totalUsdIncome = monthIncomeTx
          .filter((t) => t.originalCurrency === "USD")
          .reduce((s, t) => s + (t.originalAmount ?? 0), 0);
        const usdPotDeposits = existingPotDeposits.filter((e) => e.currency === "USD").reduce((s, e) => s + e.amountUsd, 0);
        const available = totalUsdIncome - usdPotDeposits;
        if (available < amountInUnits) {
          return { success: false, error: `Insufficient USD income available this month: $${(Math.max(0, available) / 100).toFixed(2)}` };
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await creditPot(tx, potId, amountInUnits, currency, description ?? "Deposit", sourceType, { budgetMonth: month, budgetYear: year });
    });

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[addMoneyToPot]", e);
    return { success: false, error: "Failed to add money" };
  }
}

export async function transferBetweenPots(
  fromPotId: string,
  toPotId: string,
  amount: number,
  currency: "PKR" | "USD" = "PKR"
): Promise<ActionResult> {
  try {
    const authUser = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
    const userId = authUser.id;
    const { month, year } = getCurrentPeriod(authUser.currentBudgetMonth as number | null, authUser.currentBudgetYear as number | null);
    const [fromPot, toPot] = await Promise.all([
      prisma.savingsPot.findFirst({ where: { id: fromPotId, userId } }),
      prisma.savingsPot.findFirst({ where: { id: toPotId, userId } }),
    ]);
    if (!fromPot || !toPot) return { success: false, error: "Pot not found" };

    const amountInUnits = toPaisas(amount);

    if (currency === "USD" && fromPot.currentAmountUsd < amountInUnits) {
      return { success: false, error: "Insufficient USD balance" };
    }
    if (currency === "PKR" && fromPot.currentAmount < amountInUnits) {
      return { success: false, error: "Insufficient PKR balance" };
    }

    await prisma.$transaction(async (tx) => {
      await debitPot(tx, fromPotId, amountInUnits, currency, `Transfer to ${toPot.name}`, "POT_TRANSFER", { budgetMonth: month, budgetYear: year });
      await creditPot(tx, toPotId, amountInUnits, currency, `Transfer from ${fromPot.name}`, "POT_TRANSFER", { budgetMonth: month, budgetYear: year });
    });

    revalidatePath("/savings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[transferBetweenPots]", e);
    return { success: false, error: "Failed to transfer" };
  }
}

export async function withdrawFromPot(
  potId: string,
  amount: number,
  currency: "PKR" | "USD" = "PKR",
  description?: string
): Promise<ActionResult> {
  try {
    const authUser = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
    const userId = authUser.id;
    const { month, year } = getCurrentPeriod(authUser.currentBudgetMonth as number | null, authUser.currentBudgetYear as number | null);
    const pot = await prisma.savingsPot.findFirst({ where: { id: potId, userId } });
    if (!pot) return { success: false, error: "Not found" };

    const amountInUnits = toPaisas(amount);

    if (currency === "USD" && pot.currentAmountUsd < amountInUnits) {
      return { success: false, error: "Insufficient USD balance" };
    }
    if (currency === "PKR" && pot.currentAmount < amountInUnits) {
      return { success: false, error: "Insufficient PKR balance" };
    }

    await prisma.$transaction(async (tx) => {
      // sourceType INCOME so the signed-negative entry nets against income deposits,
      // freeing the income pool for re-assignment (YNAB: correction returns to Ready to Assign)
      await debitPot(tx, potId, amountInUnits, currency, description ?? "Correction", "INCOME", { budgetMonth: month, budgetYear: year });
    });

    revalidatePath("/savings");
    return { success: true };
  } catch (e) {
    console.error("[withdrawFromPot]", e);
    return { success: false, error: "Failed to withdraw" };
  }
}

export async function deleteSavingsPot(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.savingsPot.deleteMany({ where: { id, userId } });
    revalidatePath("/savings");
    return { success: true };
  } catch (e) {
    console.error("[deleteSavingsPot]", e);
    return { success: false, error: "Failed to delete pot" };
  }
}

export async function getInvestments() {
  const userId = await getUserId();
  return prisma.investment.findMany({
    where: { userId },
    orderBy: { purchaseDate: "desc" },
  });
}

export async function createInvestment(data: {
  name: string;
  type: string;
  platform: string;
  investedAmount: number;
  currentValue: number;
  units?: number;
  purchaseDate: string;
  notes?: string;
  customFields?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.investment.create({
      data: {
        name: data.name,
        type: data.type,
        platform: data.platform,
        investedAmount: toPaisas(data.investedAmount),
        currentValue: toPaisas(data.currentValue),
        units: data.units,
        purchaseDate: new Date(data.purchaseDate),
        notes: data.notes,
        customFields: data.customFields,
        userId,
      },
    });
    revalidatePath("/savings");
    revalidatePath("/investments");
    return { success: true };
  } catch (e) {
    console.error("[createInvestment]", e);
    return { success: false, error: "Failed to add investment" };
  }
}

export async function updateInvestment(id: string, data: {
  currentValue: number;
  units?: number;
  customFields?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.investment.updateMany({
      where: { id, userId },
      data: {
        currentValue: toPaisas(data.currentValue),
        units: data.units,
        customFields: data.customFields,
        notes: data.notes,
        lastUpdated: new Date(),
      },
    });
    revalidatePath("/savings");
    revalidatePath("/investments");
    return { success: true };
  } catch (e) {
    console.error("[updateInvestment]", e);
    return { success: false, error: "Failed to update investment" };
  }
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    await prisma.investment.deleteMany({ where: { id, userId } });
    revalidatePath("/savings");
    revalidatePath("/investments");
    return { success: true };
  } catch (e) {
    console.error("[deleteInvestment]", e);
    return { success: false, error: "Failed to delete investment" };
  }
}

export async function getAverageMonthlyExpenses(): Promise<number> {
  const userId = await getUserId();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const transactions = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: sixMonthsAgo } },
    select: { amount: true, date: true },
  });

  if (transactions.length === 0) return 0;

  const byMonth: Record<string, number> = {};
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    byMonth[key] = (byMonth[key] ?? 0) + t.amount;
  }
  const months = Object.values(byMonth);
  return months.length > 0 ? months.reduce((s, m) => s + m, 0) / months.length : 0;
}

export async function getFinancialPosition() {
  const userId = await getUserId();

  const [user, transactions, savingsPots, investments, loans] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { usdTopkrRate: true } }),
    prisma.transaction.findMany({ where: { userId }, select: { amount: true, type: true } }),
    prisma.savingsPot.findMany({ where: { userId }, select: { currentAmount: true, currentAmountUsd: true } }),
    prisma.investment.findMany({ where: { userId }, select: { currentValue: true } }),
    prisma.loan.findMany({ where: { userId, status: { not: "PAID" } }, select: { remainingAmount: true, type: true } }),
  ]);

  const rate = user?.usdTopkrRate ?? 278;
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const accumulatedSavings = totalIncome - totalExpenses;

  const savingsPotsTotal = savingsPots.reduce((s, p) => {
    return s + p.currentAmount + Math.round(p.currentAmountUsd * rate);
  }, 0);

  const investmentsTotal = investments.reduce((s, i) => s + i.currentValue, 0);
  const loansOwed = loans.filter((l) => l.type === "RECEIVED").reduce((s, l) => s + l.remainingAmount, 0);
  const loansReceivable = loans.filter((l) => l.type === "GIVEN").reduce((s, l) => s + l.remainingAmount, 0);

  return {
    accumulatedSavings,
    savingsPotsTotal,
    investmentsTotal,
    loansOwed,
    loansReceivable,
    liquidAvailable: accumulatedSavings + savingsPotsTotal,
    netWorth: accumulatedSavings + savingsPotsTotal + investmentsTotal - loansOwed + loansReceivable,
  };
}

export async function getCumulativeSavings(): Promise<{
  totalAccumulated: number;
  months: { label: string; key: string; income: number; expenses: number; surplus: number; cumulative: number }[];
}> {
  const userId = await getUserId();
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: { amount: true, type: true, date: true },
    orderBy: { date: "asc" },
  });

  const byMonth: Record<string, { income: number; expenses: number }> = {};
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
    if (t.type === "INCOME") byMonth[key].income += t.amount;
    else byMonth[key].expenses += t.amount;
  }

  const sortedKeys = Object.keys(byMonth).sort();
  let cumulative = 0;
  const months = sortedKeys.map((key) => {
    const { income, expenses } = byMonth[key];
    const surplus = income - expenses;
    cumulative += surplus;
    const [year, month] = key.split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleString("default", { month: "long", year: "numeric" });
    return { label, key, income, expenses, surplus, cumulative };
  });

  return { totalAccumulated: cumulative, months };
}
