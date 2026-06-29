import { Metadata } from "next";
import { getPlanners } from "@/actions/planner";
import { PlannerClient } from "@/components/planner/planner-client";

export const metadata: Metadata = { title: "Planner — Coffer" };

export default async function PlannerPage() {
  const planners = await getPlanners();
  return (
    <div className="max-w-5xl mx-auto">
      <PlannerClient planners={planners} />
    </div>
  );
}
