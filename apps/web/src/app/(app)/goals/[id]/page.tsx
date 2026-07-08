import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGoal } from "@/actions/goals";
import { getFinancialPosition } from "@/actions/savings";
import { getCurrencies } from "@/lib/currency-helpers";
import { GoalDetailClient } from "@/components/goals/goal-detail-client";

export const metadata: Metadata = { title: "Goal Detail" };

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [goal, financialPosition, currencies] = await Promise.all([getGoal(id), getFinancialPosition(), getCurrencies()]);
  if (!goal) notFound();
  const baseSymbol = currencies.find((c) => c.isBase)?.symbol ?? "Rs";

  return <GoalDetailClient goal={goal} financialPosition={financialPosition} baseSymbol={baseSymbol} />;
}
