import { Metadata } from "next";
import { getCurrentPeriod } from "@/lib/month";
import { getBudgetWithSpending } from "@/actions/budget";
import { getCategories, getUserSettings } from "@/actions/settings";
import { BudgetClient } from "@/components/budget/budget-client";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const settings = await getUserSettings();
  const defaultPeriod = getCurrentPeriod(settings?.currentBudgetMonth, settings?.currentBudgetYear);
  const month = parseInt(params.month ?? String(defaultPeriod.month));
  const year = parseInt(params.year ?? String(defaultPeriod.year));

  const [budgetData, categories] = await Promise.all([
    getBudgetWithSpending(month, year),
    getCategories(),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <BudgetClient budgetData={budgetData} categories={categories} month={month} year={year} />
    </div>
  );
}
