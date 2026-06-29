import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGoal } from "@/actions/goals";
import { getFinancialPosition } from "@/actions/savings";
import { GoalDetailClient } from "@/components/goals/goal-detail-client";

export const metadata: Metadata = { title: "Goal Detail — Coffer" };

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [goal, financialPosition] = await Promise.all([getGoal(id), getFinancialPosition()]);
  if (!goal) notFound();

  return <GoalDetailClient goal={goal} financialPosition={financialPosition} />;
}
