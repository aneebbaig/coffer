import { Metadata } from "next";
import { getGoals } from "@/actions/goals";
import { GoalsClient } from "@/components/goals/goals-client";

export const metadata: Metadata = { title: "Goals — Coffer" };

export default async function GoalsPage() {
  const goals = await getGoals();
  return (
    <div className="max-w-5xl mx-auto">
      <GoalsClient goals={goals} />
    </div>
  );
}
