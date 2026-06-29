import { prisma } from "@/lib/prisma";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Budget period to stamp on the pot entry (the open period when the deposit/withdrawal happens). */
export interface PotEntryPeriod {
  budgetMonth: number;
  budgetYear: number;
}

export async function creditPot(
  tx: PrismaTx,
  potId: string,
  amount: number,
  currency: "PKR" | "USD",
  description: string,
  sourceType = "MANUAL",
  period?: PotEntryPeriod,
): Promise<void> {
  await tx.savingsPot.update({
    where: { id: potId },
    data: currency === "USD"
      ? { currentAmountUsd: { increment: amount } }
      : { currentAmount: { increment: amount } },
  });
  await tx.savingsPotEntry.create({
    data: {
      potId,
      amount: currency === "PKR" ? amount : 0,
      amountUsd: currency === "USD" ? amount : 0,
      currency,
      sourceType,
      description,
      budgetMonth: period?.budgetMonth ?? null,
      budgetYear: period?.budgetYear ?? null,
    },
  });
}

export async function debitPot(
  tx: PrismaTx,
  potId: string,
  amount: number,
  currency: "PKR" | "USD",
  description: string,
  sourceType = "MANUAL",
  period?: PotEntryPeriod,
): Promise<void> {
  await tx.savingsPot.update({
    where: { id: potId },
    data: currency === "USD"
      ? { currentAmountUsd: { decrement: amount } }
      : { currentAmount: { decrement: amount } },
  });
  await tx.savingsPotEntry.create({
    data: {
      potId,
      amount: currency === "PKR" ? -amount : 0,
      amountUsd: currency === "USD" ? -amount : 0,
      currency,
      sourceType,
      description,
      budgetMonth: period?.budgetMonth ?? null,
      budgetYear: period?.budgetYear ?? null,
    },
  });
}
