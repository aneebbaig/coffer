import { Metadata } from "next";
import { getGoals } from "@/actions/goals";
import { getCurrencies } from "@/lib/currency-helpers";
import { GoalsClient } from "@/components/goals/goals-client";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const [goals, currencies] = await Promise.all([getGoals(), getCurrencies()]);
  const baseSymbol = currencies.find((c) => c.isBase)?.symbol ?? "Rs";
  return (
    <div className="max-w-5xl mx-auto">
      <GoalsClient goals={goals} baseSymbol={baseSymbol} />
    </div>
  );
}
