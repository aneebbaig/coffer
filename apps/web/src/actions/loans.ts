"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { getAuthenticatedUser, getUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toPaisas, toLocalDate } from "@/lib/utils";
import { creditPot, debitPot } from "@/lib/pot-helpers";
import { getCurrentPeriod } from "@/lib/month";
import { ActionResult } from "@/types";

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

export async function createLoan(data: {
  personName: string;
  description?: string;
  type: string;
  principalAmount: number;
  date: string;
  dueDate?: string;
  notes?: string;
  deductFromPotId?: string;
  depositToPotId?: string;
}): Promise<ActionResult> {
  try {
    const userId = await getUserId();
    const amount = toPaisas(data.principalAmount);

    const loanData = {
      personName: data.personName,
      description: data.description,
      type: data.type,
      principalAmount: amount,
      remainingAmount: amount,
      date: toLocalDate(data.date),
      dueDate: data.dueDate ? toLocalDate(data.dueDate) : null,
      notes: data.notes,
      userId,
    };

    if (data.type === "GIVEN" && data.deductFromPotId) {
      const pot = await prisma.savingsPot.findFirst({ where: { id: data.deductFromPotId, userId } });
      if (!pot) return { success: false, error: "Savings pot not found" };
      if (pot.currentAmount < amount) {
        return { success: false, error: `Insufficient balance in "${pot.name}" (Rs ${(pot.currentAmount / 100).toLocaleString()} available)` };
      }
      await prisma.$transaction(async (tx) => {
        await tx.loan.create({ data: { ...loanData, sourcePotId: data.deductFromPotId } });
        await debitPot(tx, data.deductFromPotId!, amount, "PKR", `Lent to ${data.personName}`);
      });
    } else if (data.type === "RECEIVED") {
      if (!data.depositToPotId) return { success: false, error: "Select a savings pot to deposit the loan funds" };
      const pot = await prisma.savingsPot.findFirst({ where: { id: data.depositToPotId, userId } });
      if (!pot) return { success: false, error: "Savings pot not found" };
      await prisma.$transaction(async (tx) => {
        await tx.loan.create({ data: loanData });
        await creditPot(tx, data.depositToPotId!, amount, "PKR", `Loan from ${data.personName}`);
      });
    } else {
      await prisma.loan.create({ data: loanData });
    }

    revalidatePath("/loans");
    revalidatePath("/savings");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create loan";
    console.error("[createLoan]", e);
    return { success: false, error: msg };
  }
}

async function findOrCreateLoanRepaymentCategory(userId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId, name: "Loan Repayment", type: "EXPENSE" },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { userId, name: "Loan Repayment", type: "EXPENSE", color: "#6366f1", icon: "🏦" },
  });
  return created.id;
}

export async function recordPayment(loanId: string, data: {
  amount: number;
  date: string;
  notes?: string;
  fundingSource?: string;
  fundingPotId?: string;
  depositToPotId?: string;
  splitSources?: { source: "INCOME" | "SAVINGS_POT"; potId?: string; currency?: "PKR" | "USD"; pkrAmount: number }[];
  // Optional budget-period override. When omitted, the user's open period is used.
  budgetMonth?: number;
  budgetYear?: number;
}): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser({ usdTopkrRate: true, currentBudgetMonth: true, currentBudgetYear: true });
    const userId = user.id;
    const usdTopkrRate = user.usdTopkrRate as number;
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

    const createExpense = loan.type === "RECEIVED";
    const creditPotId = loan.type === "GIVEN" ? (data.depositToPotId ?? null) : null;
    const isSplit = createExpense && data.splitSources != null && data.splitSources.length > 1;

    const fundingSource = data.fundingSource ?? "INCOME";
    const fundingPotId = fundingSource === "SAVINGS_POT" ? (data.fundingPotId ?? null) : null;

    let categoryId: string | null = null;
    if (createExpense) {
      categoryId = await findOrCreateLoanRepaymentCategory(userId);
    }

    if (isSplit) {
      const totalCovered = data.splitSources!.reduce((s, src) => s + src.pkrAmount, 0);
      if (totalCovered !== paymentAmount) {
        return { success: false, error: "Split amounts must equal the payment total" };
      }
      for (const src of data.splitSources!) {
        if (src.source === "SAVINGS_POT") {
          if (!src.potId) return { success: false, error: "Select a savings pot for each split source" };
          const currency = src.currency === "USD" ? "USD" : "PKR";
          const potUnits = currency === "USD" ? Math.round(src.pkrAmount / usdTopkrRate) : src.pkrAmount;
          const pot = await prisma.savingsPot.findFirst({ where: { id: src.potId, userId } });
          if (!pot) return { success: false, error: "Savings pot not found" };
          if (currency === "USD" && pot.currentAmountUsd < potUnits) {
            return { success: false, error: `Insufficient USD balance in "${pot.name}"` };
          }
          if (currency === "PKR" && pot.currentAmount < potUnits) {
            return { success: false, error: `Insufficient balance in "${pot.name}" (Rs ${(pot.currentAmount / 100).toLocaleString()} available)` };
          }
        }
      }
    } else if (createExpense && fundingPotId) {
      const pot = await prisma.savingsPot.findFirst({ where: { id: fundingPotId, userId } });
      if (!pot) return { success: false, error: "Savings pot not found" };
      if (pot.currentAmount < paymentAmount) {
        return { success: false, error: `Insufficient balance in "${pot.name}" (Rs ${(pot.currentAmount / 100).toLocaleString()} available)` };
      }
    }

    if (creditPotId) {
      const pot = await prisma.savingsPot.findFirst({ where: { id: creditPotId, userId } });
      if (!pot) return { success: false, error: "Savings pot not found" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.loanPayment.create({
        data: { loanId, amount: paymentAmount, date: toLocalDate(data.date), notes: data.notes },
      });
      await tx.loan.update({
        where: { id: loanId },
        data: { remainingAmount: newRemaining, status: newStatus },
      });

      if (createExpense && categoryId) {
        const txFundingSource = isSplit ? "SPLIT" : fundingSource;
        const created = await tx.transaction.create({
          data: {
            amount: paymentAmount,
            type: "EXPENSE",
            categoryId,
            description: `Loan repayment - ${loan.personName}`,
            notes: data.notes ?? null,
            date: toLocalDate(data.date),
            budgetMonth: period.month,
            budgetYear: period.year,
            fundingSource: txFundingSource,
            fundingPotId: !isSplit && fundingSource === "SAVINGS_POT" ? fundingPotId : null,
            fundingCurrency: !isSplit && fundingSource === "SAVINGS_POT" ? "PKR" : null,
            fundingAmount: !isSplit && fundingSource === "SAVINGS_POT" ? paymentAmount : null,
            userId,
          },
        });

        if (isSplit) {
          for (let i = 0; i < data.splitSources!.length; i++) {
            const src = data.splitSources![i];
            const currency = src.currency === "USD" ? "USD" : "PKR";
            const potUnits = src.source === "SAVINGS_POT"
              ? (currency === "USD" ? Math.round(src.pkrAmount / usdTopkrRate) : src.pkrAmount)
              : null;
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
              await debitPot(tx, src.potId, potUnits, currency, `Expense: Loan repayment - ${loan.personName}`, "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
            }
          }
        } else if (fundingSource === "SAVINGS_POT" && fundingPotId) {
          await debitPot(tx, fundingPotId, paymentAmount, "PKR", `Expense: Loan repayment - ${loan.personName}`, "MANUAL", { budgetMonth: period.month, budgetYear: period.year });
        }
      }

      if (creditPotId) {
        await creditPot(tx, creditPotId, paymentAmount, "PKR", `Loan repaid - ${loan.personName}`);
      }
    });

    revalidatePath("/loans");
    if (createExpense) {
      revalidatePath("/expenses");
      revalidatePath("/dashboard");
      if (isSplit || fundingPotId) revalidatePath("/savings");
    }
    if (creditPotId) revalidatePath("/savings");
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

    if (loan.sourcePotId && loan.remainingAmount > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.loan.delete({ where: { id } });
        await creditPot(tx, loan.sourcePotId!, loan.remainingAmount, "PKR", `Loan deleted - returned from ${loan.personName}`);
      });
    } else {
      await prisma.loan.delete({ where: { id } });
    }

    revalidatePath("/loans");
    revalidatePath("/savings");
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
