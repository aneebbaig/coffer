import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlanner } from "@/actions/planner";
import { getFinancialPosition } from "@/actions/savings";
import { PlannerDetailClient } from "@/components/planner/planner-detail-client";

export const metadata: Metadata = { title: "Planner Detail" };

export default async function PlannerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [planner, financialPosition] = await Promise.all([getPlanner(id), getFinancialPosition()]);
  if (!planner) notFound();

  return <PlannerDetailClient planner={planner} financialPosition={financialPosition} />;
}
