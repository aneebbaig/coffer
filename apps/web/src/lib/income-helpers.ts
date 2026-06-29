import { prisma } from "@/lib/prisma";

interface IncomeIntegrityData {
  pkrExpenses: number;
  pkrPotDeposits: number;
  usdPotDeposits: number;
  totalPkrIncome: number;
  totalUsdIncome: number;
}

export async function fetchMonthIncomeIntegrityData(
  userId: string,
  month: number,
  year: number,
): Promise<IncomeIntegrityData> {
  const userPotIds = (
    await prisma.savingsPot.findMany({ where: { userId }, select: { id: true } })
  ).map((p) => p.id);

  const [allMonthIncome, incomeFundedExpenses, incomePotEntries] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: "INCOME", budgetMonth: month, budgetYear: year },
      _sum: { amount: true },
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

  const usdIncomeTx = await prisma.transaction.findMany({
    where: { userId, type: "INCOME", budgetMonth: month, budgetYear: year, originalCurrency: "USD" },
    select: { originalAmount: true },
  });

  return {
    totalPkrIncome: allMonthIncome._sum.amount ?? 0,
    pkrExpenses: incomeFundedExpenses._sum.amount ?? 0,
    pkrPotDeposits: incomePotEntries
      .filter((e) => e.currency === "PKR")
      .reduce((s, e) => s + e.amount, 0),
    totalUsdIncome: usdIncomeTx.reduce((s, t) => s + (t.originalAmount ?? 0), 0),
    usdPotDeposits: incomePotEntries
      .filter((e) => e.currency === "USD")
      .reduce((s, e) => s + e.amountUsd, 0),
  };
}
