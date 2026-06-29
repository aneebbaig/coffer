"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthenticatedUser, getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validations";
import { ActionResult } from "@/types";
import { getCurrentPeriod } from "@/lib/month";
import { toPaisas, toLocalDate } from "@/lib/utils";
import { creditPot, debitPot, type PotEntryPeriod } from "@/lib/pot-helpers";
import { fetchMonthIncomeIntegrityData } from "@/lib/income-helpers";
import { revalidateTransactionPaths } from "@/lib/revalidate";
import { sendEmail, budgetWarningEmail, budgetExceededEmail, doomSpendingEmail } from "@/lib/email";
import { MAX_FUNDING_SOURCES } from "@/lib/constants";

// ─── internal helpers ─────────────────────────────────────────────────────────

function fundingEntryDescription(description: string) {
  return `Expense: ${description}`;
}

/** Convert a PKR-paisas amount to the native units of a pot (paisas for PKR pots, cents for USD pots). */
function getPotUnits(pkrPaisas: number, currency: "PKR" | "USD", usdToPkrRate: number): number {
  return currency === "USD" ? Math.round(pkrPaisas / usdToPkrRate) : pkrPaisas;
}

/**
 * How many PKR paisas of income funding does a transaction consume?
 * - INCOME:       full amount
 * - SAVINGS_POT:  zero (funded from a pot, not income)
 * - SPLIT:        sum of pkrAmount for rows where source = "INCOME"
 */
function incomePkrForTransaction(t: {
  amount: number;
  fundingSource: string;
  fundingSources: { source: string; pkrAmount: number }[];
}): number {
  if (t.fundingSource === "SAVINGS_POT") return 0;
  if (t.fundingSource === "SPLIT") {
    return t.fundingSources
      .filter((s) => s.source === "INCOME")
      .reduce((sum, s) => sum + s.pkrAmount, 0);
  }
  return t.amount; // INCOME — full amount
}

// ─── income availability ──────────────────────────────────────────────────────

async function getIncomeAvailableForMonth(
  userId: string,
  month: number,
  year: number,
  excludeTransactionId?: string,
): Promise<number> {
  const userPotIds = (await prisma.savingsPot.findMany({ where: { userId }, select: { id: true } })).map((p) => p.id);

  const [income, expenseTxns, incomePotDeposits] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId, type: "INCOME", budgetMonth: month, budgetYear: year,
        ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
      },
      _sum: { amount: true },
    }),
    // Fetch all expense txns with their split rows so we can compute income portion correctly
    prisma.transaction.findMany({
      where: {
        userId, type: "EXPENSE", budgetMonth: month, budgetYear: year,
        ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
      },
      select: { amount: true, fundingSource: true, fundingSources: { select: { source: true, pkrAmount: true } } },
    }),
    prisma.savingsPotEntry.findMany({
      where: { potId: { in: userPotIds }, sourceType: "INCOME", budgetMonth: month, budgetYear: year },
      select: { amount: true, currency: true },
    }),
  ]);

  const totalIncome = income._sum.amount ?? 0;
  const incomeFundedExpenses = expenseTxns.reduce((sum, t) => sum + incomePkrForTransaction(t), 0);
  const pkrPotDeposits = incomePotDeposits.filter((e) => e.currency === "PKR").reduce((s, e) => s + e.amount, 0);

  return totalIncome - incomeFundedExpenses - pkrPotDeposits;
}

// ─── funding validation ───────────────────────────────────────────────────────

interface FundingSource {
  source: "INCOME" | "SAVINGS_POT";
  potId?: string;
  currency?: "PKR" | "USD";
  pkrAmount: number; // how much of the expense (PKR paisas) this source covers
}

async function validateFundingSources(
  userId: string,
  sources: FundingSource[],
  month: number,
  year: number,
  usdToPkrRate: number,
  excludeTransactionId?: string,
): Promise<string | null> {
  for (const src of sources) {
    if (src.source === "INCOME") {
      const available = await getIncomeAvailableForMonth(userId, month, year, excludeTransactionId);
      if (available < src.pkrAmount) {
        return `Insufficient monthly income. Available: Rs ${(available / 100).toLocaleString()}, need: Rs ${(src.pkrAmount / 100).toLocaleString()}`;
      }
    } else {
      if (!src.potId) return "Choose a savings pot";
      const currency = src.currency === "USD" ? "USD" : "PKR";
      const potUnits = getPotUnits(src.pkrAmount, currency, usdToPkrRate);
      const pot = await prisma.savingsPot.findFirst({ where: { id: src.potId, userId } });
      if (!pot) return "Savings pot not found";
      if (currency === "USD" && pot.currentAmountUsd < potUnits) {
        return `Insufficient USD balance in ${pot.name}. Available: $${(pot.currentAmountUsd / 100).toFixed(2)}`;
      }
      if (currency === "PKR" && pot.currentAmount < potUnits) {
        return `Insufficient PKR balance in ${pot.name}. Available: Rs ${(pot.currentAmount / 100).toLocaleString()}`;
      }
    }
  }
  return null;
}

// ─── pot debit/credit helpers for split rows ─────────────────────────────────

async function debitFundingSources(
  tx: Prisma.TransactionClient,
  sources: FundingSource[],
  usdToPkrRate: number,
  description: string,
  period: PotEntryPeriod,
) {
  for (const src of sources) {
    if (src.source === "SAVINGS_POT" && src.potId) {
      const currency = src.currency === "USD" ? "USD" : "PKR";
      const potUnits = getPotUnits(src.pkrAmount, currency, usdToPkrRate);
      await debitPot(tx, src.potId, potUnits, currency, fundingEntryDescription(description), "MANUAL", period);
    }
  }
}

async function creditFundingSources(
  tx: Prisma.TransactionClient,
  rows: { source: string; potId: string | null; currency: string | null; potAmount: number | null }[],
  description: string,
  period: PotEntryPeriod,
) {
  for (const row of rows) {
    if (row.source === "SAVINGS_POT" && row.potId && row.potAmount && row.currency) {
      await creditPot(tx, row.potId, row.potAmount, row.currency as "PKR" | "USD", `Reversal: ${description}`, "MANUAL", period);
    }
  }
}

// ─── public read queries ──────────────────────────────────────────────────────

export async function getTransactions(filters?: {
  type?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  month?: number;
  year?: number;
}) {
  const userId = await getUserId();

  const where: Prisma.TransactionWhereInput = { userId };
  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.search) where.description = { contains: filters.search };
  if (filters?.startDate || filters?.endDate) {
    where.date = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }
  if (filters?.month && filters?.year) {
    where.budgetMonth = filters.month;
    where.budgetYear = filters.year;
  }

  return prisma.transaction.findMany({
    where,
    include: {
      category: true,
      fundingPot: { select: { id: true, name: true, type: true } },
      fundingSources: { orderBy: { priority: "asc" }, include: { pot: { select: { id: true, name: true, type: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getExpenseFundingContext(month: number, year: number) {
  const user = await getAuthenticatedUser({ usdTopkrRate: true });

  const [income, expenseTxns, pots] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: user.id, type: "INCOME", budgetMonth: month, budgetYear: year },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "EXPENSE", budgetMonth: month, budgetYear: year },
      select: { amount: true, fundingSource: true, fundingSources: { select: { source: true, pkrAmount: true } } },
    }),
    prisma.savingsPot.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, type: true, currentAmount: true, currentAmountUsd: true },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const potIds = pots.map((p) => p.id);
  const incomePotDeposits = await prisma.savingsPotEntry.findMany({
    where: { potId: { in: potIds }, sourceType: "INCOME", budgetMonth: month, budgetYear: year },
    select: { amount: true, currency: true },
  });
  const pkrPotDeposits = incomePotDeposits.filter((e) => e.currency === "PKR").reduce((s, e) => s + e.amount, 0);
  const incomeFundedExpenses = expenseTxns.reduce((sum, t) => sum + incomePkrForTransaction(t), 0);

  return {
    monthlyIncomeAvailable: (income._sum.amount ?? 0) - incomeFundedExpenses - pkrPotDeposits,
    usdTopkrRate: user.usdTopkrRate as number,
    pots,
  };
}

// ─── createTransaction ────────────────────────────────────────────────────────

export async function createTransaction(data: {
  amount: number;
  type: string;
  categoryId: string;
  description: string;
  notes?: string;
  date: string;
  // Optional budget-period override. When omitted, the user's open period is used.
  budgetMonth?: number;
  budgetYear?: number;
  isRecurring: boolean;
  recurringFrequency?: string;
  tags: string;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  // Single-source (backward compat)
  fundingSource?: string;
  fundingPotId?: string;
  fundingCurrency?: "PKR" | "USD";
  // Split sources (up to MAX_FUNDING_SOURCES)
  splitSources?: { source: "INCOME" | "SAVINGS_POT"; potId?: string; currency?: "PKR" | "USD"; pkrAmount: number }[];
}): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser({ usdTopkrRate: true, email: true, currentBudgetMonth: true, currentBudgetYear: true, notifyDoomSpending: true, notifyBudgetWarning: true });
    const usdTopkrRate = user.usdTopkrRate as number;
    // New transactions are filed under the user's open budget period (not their calendar date),
    // unless an explicit override month is supplied.
    const period = (data.budgetMonth && data.budgetYear)
      ? { month: data.budgetMonth, year: data.budgetYear }
      : getCurrentPeriod(user.currentBudgetMonth as number | null, user.currentBudgetYear as number | null);
    const validated = transactionSchema.safeParse(data);
    if (!validated.success) return { success: false, error: "Invalid data" };

    const amountPaisas = toPaisas(data.amount);
    const txDate = toLocalDate(data.date);
    const isSplit = data.type === "EXPENSE" && data.splitSources && data.splitSources.length > 1;

    if (data.type === "EXPENSE") {
      if (isSplit) {
        // Validate split sources
        if (data.splitSources!.length > MAX_FUNDING_SOURCES) {
          return { success: false, error: `Maximum ${MAX_FUNDING_SOURCES} funding sources allowed` };
        }
        const totalCovered = data.splitSources!.reduce((s, src) => s + src.pkrAmount, 0);
        if (totalCovered !== amountPaisas) {
          return { success: false, error: "Funding source amounts must sum to the total expense" };
        }
        const err = await validateFundingSources(user.id, data.splitSources!, period.month, period.year, usdTopkrRate);
        if (err) return { success: false, error: err };
      } else {
        // Single source validation (existing logic)
        const fundingSource = data.fundingSource ?? "INCOME";
        const fundingCurrency = data.fundingCurrency === "USD" ? "USD" : "PKR";
        const pkrAmount = amountPaisas;
        const err = await validateFundingSources(user.id, [{ source: fundingSource as "INCOME" | "SAVINGS_POT", potId: data.fundingPotId, currency: fundingCurrency, pkrAmount }], period.month, period.year, usdTopkrRate);
        if (err) return { success: false, error: err };
      }
    }

    const fundingSource = isSplit ? "SPLIT" : (data.type === "EXPENSE" ? data.fundingSource ?? "INCOME" : "INCOME");
    const fundingCurrency = data.fundingCurrency === "USD" ? "USD" : "PKR";
    const fundingAmount = fundingSource === "SAVINGS_POT"
      ? getPotUnits(amountPaisas, fundingCurrency, usdTopkrRate)
      : null;

    await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: amountPaisas,
          type: data.type,
          categoryId: data.categoryId,
          description: data.description,
          notes: data.notes,
          date: txDate,
          budgetMonth: period.month,
          budgetYear: period.year,
          isRecurring: data.isRecurring,
          recurringFrequency: data.recurringFrequency ?? null,
          tags: data.tags,
          originalCurrency: data.originalCurrency ?? null,
          originalAmount: data.originalAmount ? toPaisas(data.originalAmount) : null,
          exchangeRate: data.exchangeRate ?? null,
          fundingSource,
          fundingPotId: fundingSource === "SAVINGS_POT" ? data.fundingPotId : null,
          fundingCurrency: fundingSource === "SAVINGS_POT" ? fundingCurrency : null,
          fundingAmount,
          userId: user.id,
        },
      });

      if (isSplit) {
        // Create child funding source rows and debit pots
        for (let i = 0; i < data.splitSources!.length; i++) {
          const src = data.splitSources![i];
          const currency = src.currency === "USD" ? "USD" : "PKR";
          const potUnits = src.source === "SAVINGS_POT" ? getPotUnits(src.pkrAmount, currency, usdTopkrRate) : null;
          await tx.transactionFundingSource.create({
            data: {
              transactionId: created.id,
              priority: i + 1,
              source: src.source,
              potId: src.potId ?? null,
              currency: src.source === "SAVINGS_POT" ? currency : null,
              potAmount: potUnits,
              pkrAmount: src.pkrAmount,
            },
          });
          if (src.source === "SAVINGS_POT" && src.potId && potUnits) {
            await debitPot(tx, src.potId, potUnits, currency, fundingEntryDescription(data.description), "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
          }
        }
      } else if (data.type === "EXPENSE" && fundingSource === "SAVINGS_POT" && data.fundingPotId && fundingAmount) {
        await debitPot(tx, data.fundingPotId, fundingAmount, fundingCurrency, fundingEntryDescription(data.description), "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
      }
    });

    // Post-create notifications
    if (data.type === "EXPENSE") {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentExpenses = await prisma.transaction.findMany({
        where: { userId: user.id, type: "EXPENSE", date: { gte: twoHoursAgo } },
        select: { amount: true },
      });
      if (recentExpenses.length >= 3 && user.notifyDoomSpending) {
        const total = recentExpenses.reduce((s, t) => s + t.amount, 0) + amountPaisas;
        await sendEmail(user.email as string, "🛑 Doom Spending Alert — Coffer", doomSpendingEmail(recentExpenses.length + 1, total));
      }

      const [budgetCat, spent] = await Promise.all([
        prisma.budgetCategory.findFirst({
          where: { categoryId: data.categoryId, budget: { month: period.month, year: period.year } },
          include: { category: { select: { name: true } } },
        }),
        prisma.transaction.aggregate({
          where: { userId: user.id, type: "EXPENSE", categoryId: data.categoryId, budgetMonth: period.month, budgetYear: period.year },
          _sum: { amount: true },
        }),
      ]);
      if (budgetCat && user.notifyBudgetWarning) {
        const totalSpent = (spent._sum.amount ?? 0) + amountPaisas;
        const pct = Math.round((totalSpent / budgetCat.allocatedAmount) * 100);
        if (pct >= 100 && (totalSpent - amountPaisas) < budgetCat.allocatedAmount) {
          await sendEmail(user.email as string, `🚨 Budget Exceeded: ${budgetCat.category.name} — Coffer`, budgetExceededEmail(budgetCat.category.name, totalSpent, budgetCat.allocatedAmount));
        } else if (pct >= 85 && pct < 100) {
          const prevPct = Math.round(((totalSpent - amountPaisas) / budgetCat.allocatedAmount) * 100);
          if (prevPct < 85) {
            await sendEmail(user.email as string, `⚠️ Budget Warning: ${budgetCat.category.name} — Coffer`, budgetWarningEmail(budgetCat.category.name, pct, totalSpent, budgetCat.allocatedAmount));
          }
        }
      }
    }

    revalidateTransactionPaths();
    return { success: true };
  } catch (e) {
    console.error("[createTransaction]", e);
    return { success: false, error: "Failed to create transaction" };
  }
}

// ─── updateTransaction ────────────────────────────────────────────────────────

export async function updateTransaction(id: string, data: {
  amount: number;
  type: string;
  categoryId: string;
  description: string;
  notes?: string;
  date: string;
  // Optional budget-period override. When omitted, the existing period is preserved.
  budgetMonth?: number;
  budgetYear?: number;
  isRecurring: boolean;
  recurringFrequency?: string;
  tags: string;
  fundingSource?: string;
  fundingPotId?: string;
  fundingCurrency?: "PKR" | "USD";
  splitSources?: { source: "INCOME" | "SAVINGS_POT"; potId?: string; currency?: "PKR" | "USD"; pkrAmount: number }[];
}): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser({ usdTopkrRate: true });
    const usdTopkrRate = user.usdTopkrRate as number;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: { fundingSources: true },
    });
    if (!existing) return { success: false, error: "Not found" };

    const amountPaisas = toPaisas(data.amount);
    const txDate = toLocalDate(data.date);
    const isSplit = data.type === "EXPENSE" && data.splitSources && data.splitSources.length > 1;
    // Preserve the original period unless an explicit override re-files the transaction.
    const period: PotEntryPeriod = (data.budgetMonth && data.budgetYear)
      ? { budgetMonth: data.budgetMonth, budgetYear: data.budgetYear }
      : { budgetMonth: existing.budgetMonth, budgetYear: existing.budgetYear };

    // Income reduction check
    if (existing.type === "INCOME" && data.type === "INCOME" && amountPaisas < existing.amount) {
      const { budgetMonth: month, budgetYear: year } = existing;
      const d = await fetchMonthIncomeIntegrityData(user.id, month, year);
      const newMonthPkrIncome = d.totalPkrIncome - existing.amount + amountPaisas;
      if (newMonthPkrIncome < d.pkrExpenses + d.pkrPotDeposits) {
        const deficit = d.pkrExpenses + d.pkrPotDeposits - newMonthPkrIncome;
        return { success: false, error: `Cannot reduce income — Rs ${(deficit / 100).toLocaleString()} in expenses/savings this month would be left unfunded.` };
      }
    }

    if (data.type === "EXPENSE") {
      if (isSplit) {
        if (data.splitSources!.length > MAX_FUNDING_SOURCES) return { success: false, error: `Maximum ${MAX_FUNDING_SOURCES} funding sources` };
        const totalCovered = data.splitSources!.reduce((s, src) => s + src.pkrAmount, 0);
        if (totalCovered !== amountPaisas) return { success: false, error: "Source amounts must sum to total expense" };
        const err = await validateFundingSources(user.id, data.splitSources!, period.budgetMonth, period.budgetYear, usdTopkrRate, id);
        if (err) return { success: false, error: err };
      } else {
        const fundingSource = data.fundingSource ?? "INCOME";
        const fundingCurrency = data.fundingCurrency === "USD" ? "USD" : "PKR";
        const err = await validateFundingSources(user.id, [{ source: fundingSource as "INCOME" | "SAVINGS_POT", potId: data.fundingPotId, currency: fundingCurrency, pkrAmount: amountPaisas }], period.budgetMonth, period.budgetYear, usdTopkrRate, id);
        if (err) return { success: false, error: err };
      }
    }

    const newFundingSource = isSplit ? "SPLIT" : (data.type === "EXPENSE" ? data.fundingSource ?? "INCOME" : "INCOME");
    const newFundingCurrency = data.fundingCurrency === "USD" ? "USD" : "PKR";
    const newFundingAmount = newFundingSource === "SAVINGS_POT"
      ? getPotUnits(amountPaisas, newFundingCurrency, usdTopkrRate)
      : null;

    await prisma.$transaction(async (tx) => {
      // Reverse old funding
      if (existing.type === "EXPENSE") {
        if (existing.fundingSource === "SAVINGS_POT" && existing.fundingPotId && existing.fundingAmount && existing.fundingCurrency) {
          await creditPot(tx, existing.fundingPotId, existing.fundingAmount, existing.fundingCurrency as "PKR" | "USD", `Reversal: ${existing.description}`, "MANUAL", period);
        } else if (existing.fundingSource === "SPLIT" && existing.fundingSources.length > 0) {
          await creditFundingSources(tx, existing.fundingSources, existing.description, period);
          await tx.transactionFundingSource.deleteMany({ where: { transactionId: id } });
        }
      }

      // Update transaction record
      await tx.transaction.update({
        where: { id },
        data: {
          amount: amountPaisas,
          type: data.type,
          categoryId: data.categoryId,
          description: data.description,
          notes: data.notes,
          date: txDate,
          budgetMonth: period.budgetMonth,
          budgetYear: period.budgetYear,
          isRecurring: data.isRecurring,
          recurringFrequency: data.recurringFrequency ?? null,
          tags: data.tags,
          fundingSource: newFundingSource,
          fundingPotId: newFundingSource === "SAVINGS_POT" ? data.fundingPotId : null,
          fundingCurrency: newFundingSource === "SAVINGS_POT" ? newFundingCurrency : null,
          fundingAmount: newFundingAmount,
        },
      });

      // Apply new funding
      if (isSplit) {
        for (let i = 0; i < data.splitSources!.length; i++) {
          const src = data.splitSources![i];
          const currency = src.currency === "USD" ? "USD" : "PKR";
          const potUnits = src.source === "SAVINGS_POT" ? getPotUnits(src.pkrAmount, currency, usdTopkrRate) : null;
          await tx.transactionFundingSource.create({
            data: {
              transactionId: id,
              priority: i + 1,
              source: src.source,
              potId: src.potId ?? null,
              currency: src.source === "SAVINGS_POT" ? currency : null,
              potAmount: potUnits,
              pkrAmount: src.pkrAmount,
            },
          });
          if (src.source === "SAVINGS_POT" && src.potId && potUnits) {
            await debitPot(tx, src.potId, potUnits, currency, fundingEntryDescription(data.description), "MANUAL", period);
          }
        }
      } else if (data.type === "EXPENSE" && newFundingSource === "SAVINGS_POT" && data.fundingPotId && newFundingAmount) {
        await debitPot(tx, data.fundingPotId, newFundingAmount, newFundingCurrency, fundingEntryDescription(data.description), "MANUAL", period);
      }
    });

    revalidateTransactionPaths();
    return { success: true };
  } catch (e) {
    console.error("[updateTransaction]", e);
    return { success: false, error: "Failed to update transaction" };
  }
}

// ─── deleteTransaction ────────────────────────────────────────────────────────

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();

    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { fundingSources: true },
    });
    if (!existing) return { success: false, error: "Not found" };

    const period: PotEntryPeriod = { budgetMonth: existing.budgetMonth, budgetYear: existing.budgetYear };

    if (existing.type === "INCOME") {
      const { budgetMonth: month, budgetYear: year } = existing;
      const d = await fetchMonthIncomeIntegrityData(userId, month, year);
      const remainingPkrIncome = d.totalPkrIncome - existing.amount;
      if (remainingPkrIncome < d.pkrExpenses + d.pkrPotDeposits) {
        const deficit = d.pkrExpenses + d.pkrPotDeposits - remainingPkrIncome;
        return { success: false, error: `Cannot delete — Rs ${(deficit / 100).toLocaleString()} in expenses/savings this month depend on this income. Remove those first.` };
      }
      if (existing.originalCurrency === "USD" && (existing.originalAmount ?? 0) > 0) {
        const remainingUsdIncome = d.totalUsdIncome - (existing.originalAmount ?? 0);
        if (remainingUsdIncome < d.usdPotDeposits) {
          const deficit = d.usdPotDeposits - remainingUsdIncome;
          return { success: false, error: `Cannot delete — $${(deficit / 100).toFixed(2)} in savings depends on this USD income. Remove those pot deposits first.` };
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (existing.type === "EXPENSE") {
        if (existing.fundingSource === "SAVINGS_POT" && existing.fundingPotId && existing.fundingAmount && existing.fundingCurrency) {
          await creditPot(tx, existing.fundingPotId, existing.fundingAmount, existing.fundingCurrency as "PKR" | "USD", `Deleted expense reversal: ${existing.description}`, "MANUAL", period);
        } else if (existing.fundingSource === "SPLIT" && existing.fundingSources.length > 0) {
          await creditFundingSources(tx, existing.fundingSources, existing.description, period);
        }
      }
      await tx.transaction.delete({ where: { id } });
    });

    revalidateTransactionPaths();
    return { success: true };
  } catch (e) {
    console.error("[deleteTransaction]", e);
    return { success: false, error: "Failed to delete transaction" };
  }
}

// ─── analytics ────────────────────────────────────────────────────────────────

export async function getMonthlySummary(month: number, year: number) {
  const userId = await getUserId();

  const transactions = await prisma.transaction.findMany({
    where: { userId, budgetMonth: month, budgetYear: year },
  });

  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);

  return { totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses };
}

export async function getSpendingByCategory(month: number, year: number) {
  const userId = await getUserId();

  const transactions = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", budgetMonth: month, budgetYear: year },
    include: { category: true },
  });

  const byCategory: Record<string, { name: string; color: string; amount: number }> = {};
  for (const t of transactions) {
    if (!byCategory[t.categoryId]) {
      byCategory[t.categoryId] = { name: t.category.name, color: t.category.color, amount: 0 };
    }
    byCategory[t.categoryId].amount += t.amount;
  }

  return Object.values(byCategory).sort((a, b) => b.amount - a.amount);
}

export async function getMonthlyTrend(months = 6) {
  const userId = await getUserId();

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { amount: true, type: true, date: true },
  });

  const byMonth: Record<string, { income: number; expenses: number }> = {};
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
    if (t.type === "INCOME") byMonth[key].income += t.amount;
    else byMonth[key].expenses += t.amount;
  }

  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const baseMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${baseMonth.getFullYear()}-${String(baseMonth.getMonth() + 1).padStart(2, "0")}`;
    const { income, expenses } = byMonth[key] ?? { income: 0, expenses: 0 };
    result.push({
      month: baseMonth.toLocaleString("default", { month: "short" }),
      year: baseMonth.getFullYear(),
      income,
      expenses,
    });
  }

  return result;
}
