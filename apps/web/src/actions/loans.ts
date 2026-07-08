"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthenticatedUser, getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toPaisas, toLocalDate } from "@/lib/utils";
import { creditPot, debitPot } from "@/lib/pot-helpers";
import { getBaseCurrency } from "@/lib/currency-helpers";
import { getCurrentPeriod } from "@/lib/month";
import { ActionResult } from "@/types";

// Loans always operate in the household's base currency (out of scope for
// per-loan currency selection) - only pot balances/income are multi-currency.

export async function getLoans(filter?: "ACTIVE" | "PAID" | "ALL") {
  const userId = await getUserId();
  const where: Prisma.LoanWhereInput = { userId };
  if (filter && filter !== "ALL") where.status = filter;

  return prisma.loan.findMany({
    where,
    include: { payments: { orderBy: { date: "desc" } } },
    orderBy: [{ status: "asc" }, { date: "desc" }],
  });
}

async function findOrCreateCategory(userId: string, name: string, icon: string): Promise<string> {
  const existing = await prisma.category.findFirst({ where: { userId, name } });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { userId, name, type: "BOTH", color: "#6366f1", icon },
  });
  return created.id;
}

async function findOrCreateLoanCategory(userId: string): Promise<string> {
  return findOrCreateCategory(userId, "Loan", "🏦");
}

async function findOrCreateLoanRepaymentCategory(userId: string): Promise<string> {
  return findOrCreateCategory(userId, "Loan Repayment", "🏦");
}

export async function createLoan(data: {
  personName: string;
  description?: string;
  type: string;
  principalAmount: number;
  date: string;
  dueDate?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
    const userId = user.id;
    const amount = toPaisas(data.principalAmount);
    const period = getCurrentPeriod(user.currentBudgetMonth as number | null, user.currentBudgetYear as number | null);
    const categoryId = await findOrCreateLoanCategory(userId);

    const loanDate = toLocalDate(data.date);
    const isGiven = data.type === "GIVEN";

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          amount,
          type: isGiven ? "EXPENSE" : "INCOME",
          categoryId,
          description: isGiven ? `Loan to ${data.personName}` : `Loan from ${data.personName}`,
          notes: data.notes ?? null,
          date: loanDate,
          budgetMonth: period.month,
          budgetYear: period.year,
          fundingSource: "INCOME",
          tags: "loan",
          userId,
        },
      });
      await tx.loan.create({
        data: {
          personName: data.personName,
          description: data.description,
          type: data.type,
          principalAmount: amount,
          remainingAmount: amount,
          date: loanDate,
          dueDate: data.dueDate ? toLocalDate(data.dueDate) : null,
          notes: data.notes,
          transactionId: transaction.id,
          userId,
        },
      });
    });

    revalidatePath("/loans");
    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create loan";
    console.error("[createLoan]", e);
    return { success: false, error: msg };
  }
}

export async function recordPayment(loanId: string, data: {
  amount: number;
  date: string;
  notes?: string;
  fundingSource?: string;
  fundingPotId?: string;
  splitSources?: { source: "INCOME" | "SAVINGS_POT"; potId?: string; currencyId?: string; pkrAmount: number }[];
  // Optional budget-period override. When omitted, the user's open period is used.
  budgetMonth?: number;
  budgetYear?: number;
}): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser({ currentBudgetMonth: true, currentBudgetYear: true });
    const userId = user.id;
    const base = await getBaseCurrency();
    const period = (data.budgetMonth && data.budgetYear)
      ? { month: data.budgetMonth, year: data.budgetYear }
      : getCurrentPeriod(user.currentBudgetMonth as number | null, user.currentBudgetYear as number | null);

    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) return { success: false, error: "Loan not found" };

    const paymentAmount = toPaisas(data.amount);
    if (paymentAmount > loan.remainingAmount) {
      return { success: false, error: "Payment exceeds remaining balance" };
    }

    const newRemaining = loan.remainingAmount - paymentAmount;
    const newStatus = newRemaining === 0 ? "PAID" : "PARTIALLY_PAID";

    // RECEIVED loan (I borrowed): paying it back is an EXPENSE, may be funded
    // from income or a savings pot. GIVEN loan (I lent): getting repaid is
    // plain INCOME - no pot involved.
    const isExpense = loan.type === "RECEIVED";
    const isSplit = isExpense && data.splitSources != null && data.splitSources.length > 1;

    const fundingSource = data.fundingSource ?? "INCOME";
    const fundingPotId = fundingSource === "SAVINGS_POT" ? (data.fundingPotId ?? null) : null;

    const categoryId = await findOrCreateLoanRepaymentCategory(userId);

    if (isSplit) {
      const totalCovered = data.splitSources!.reduce((s, src) => s + src.pkrAmount, 0);
      if (totalCovered !== paymentAmount) {
        return { success: false, error: "Split amounts must equal the payment total" };
      }
      for (const src of data.splitSources!) {
        if (src.source === "SAVINGS_POT") {
          if (!src.potId || !src.currencyId) return { success: false, error: "Select a savings pot for each split source" };
          const [currency, balance] = await Promise.all([
            prisma.currency.findUnique({ where: { id: src.currencyId } }),
            prisma.savingsPotBalance.findUnique({ where: { potId_currencyId: { potId: src.potId, currencyId: src.currencyId } } }),
          ]);
          const pot = await prisma.savingsPot.findFirst({ where: { id: src.potId, userId } });
          if (!pot) return { success: false, error: "Savings pot not found" };
          if (!currency) return { success: false, error: "Currency not found" };
          const potUnits = Math.round(src.pkrAmount / currency.rateToBase);
          if ((balance?.amount ?? 0) < potUnits) {
            return { success: false, error: `Insufficient ${currency.code} balance in "${pot.name}"` };
          }
        }
      }
    } else if (isExpense && fundingPotId) {
      const [pot, balance] = await Promise.all([
        prisma.savingsPot.findFirst({ where: { id: fundingPotId, userId } }),
        prisma.savingsPotBalance.findUnique({ where: { potId_currencyId: { potId: fundingPotId, currencyId: base.id } } }),
      ]);
      if (!pot) return { success: false, error: "Savings pot not found" };
      if ((balance?.amount ?? 0) < paymentAmount) {
        return { success: false, error: `Insufficient balance in "${pot.name}" (${base.symbol} ${((balance?.amount ?? 0) / 100).toLocaleString()} available)` };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.loanPayment.create({
        data: { loanId, amount: paymentAmount, date: toLocalDate(data.date), notes: data.notes },
      });
      await tx.loan.update({
        where: { id: loanId },
        data: { remainingAmount: newRemaining, status: newStatus },
      });

      const txFundingSource = isExpense ? (isSplit ? "SPLIT" : fundingSource) : "INCOME";
      const created = await tx.transaction.create({
        data: {
          amount: paymentAmount,
          type: isExpense ? "EXPENSE" : "INCOME",
          categoryId,
          description: `Loan repayment - ${loan.personName}`,
          notes: data.notes ?? null,
          date: toLocalDate(data.date),
          budgetMonth: period.month,
          budgetYear: period.year,
          fundingSource: txFundingSource,
          fundingPotId: isExpense && !isSplit && fundingSource === "SAVINGS_POT" ? fundingPotId : null,
          fundingCurrencyId: isExpense && !isSplit && fundingSource === "SAVINGS_POT" ? base.id : null,
          fundingAmount: isExpense && !isSplit && fundingSource === "SAVINGS_POT" ? paymentAmount : null,
          tags: "loan",
          userId,
        },
      });

      if (isExpense && isSplit) {
        for (let i = 0; i < data.splitSources!.length; i++) {
          const src = data.splitSources![i];
          const isPot = src.source === "SAVINGS_POT" && src.currencyId;
          const currency = isPot ? await tx.currency.findUnique({ where: { id: src.currencyId! } }) : null;
          const potUnits = currency ? Math.round(src.pkrAmount / currency.rateToBase) : null;
          await tx.transactionFundingSource.create({
            data: {
              transactionId: created.id,
              priority: i + 1,
              source: src.source,
              potId: src.potId ?? null,
              currencyId: isPot ? src.currencyId : null,
              potAmount: potUnits,
              pkrAmount: src.pkrAmount,
            },
          });
          if (src.source === "SAVINGS_POT" && src.potId && src.currencyId && potUnits) {
            await debitPot(tx, src.potId, potUnits, src.currencyId, `Expense: Loan repayment - ${loan.personName}`, "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
          }
        }
      } else if (isExpense && fundingSource === "SAVINGS_POT" && fundingPotId) {
        await debitPot(tx, fundingPotId, paymentAmount, base.id, `Expense: Loan repayment - ${loan.personName}`, "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
      }
    });

    revalidatePath("/loans");
    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/dashboard");
    if (isSplit || fundingPotId) revalidatePath("/savings");
    return { success: true };
  } catch (e) {
    console.error("[recordPayment]", e);
    return { success: false, error: "Failed to record payment" };
  }
}

export async function markLoanPaid(loanId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
    if (!loan) return { success: false, error: "Not found" };

    await prisma.$transaction([
      prisma.loanPayment.create({
        data: { loanId, amount: loan.remainingAmount, date: new Date(), notes: "Marked as fully paid" },
      }),
      prisma.loan.update({
        where: { id: loanId },
        data: { remainingAmount: 0, status: "PAID" },
      }),
    ]);

    revalidatePath("/loans");
    return { success: true };
  } catch (e) {
    console.error("[markLoanPaid]", e);
    return { success: false, error: "Failed to mark as paid" };
  }
}

export async function deleteLoan(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const loan = await prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) return { success: false, error: "Loan not found" };

    // Deleting the linked principal transaction cascades to delete this loan
    // (and its payment history) - no pot balances to reverse anymore.
    await prisma.transaction.delete({ where: { id: loan.transactionId } });

    revalidatePath("/loans");
    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("[deleteLoan]", e);
    return { success: false, error: "Failed to delete loan" };
  }
}

export async function getLoanSummary() {
  const userId = await getUserId();
  const loans = await prisma.loan.findMany({ where: { userId, status: { not: "PAID" } } });

  const totalGiven = loans.filter((l) => l.type === "GIVEN").reduce((s, l) => s + l.remainingAmount, 0);
  const totalReceived = loans.filter((l) => l.type === "RECEIVED").reduce((s, l) => s + l.remainingAmount, 0);

  return { totalGiven, totalReceived, netPosition: totalGiven - totalReceived };
}
