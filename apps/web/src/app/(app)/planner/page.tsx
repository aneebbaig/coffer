import { Metadata } from "next";
import { getPlanners } from "@/actions/planner";
import { getCurrencies } from "@/lib/currency-helpers";
import { PlannerClient } from "@/components/planner/planner-client";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage() {
  const [planners, currencies] = await Promise.all([getPlanners(), getCurrencies()]);
  const baseSymbol = currencies.find((c) => c.isBase)?.symbol ?? "Rs";
  return (
    <div className="max-w-5xl mx-auto">
      <PlannerClient planners={planners} baseSymbol={baseSymbol} />
    </div>
  );
}
