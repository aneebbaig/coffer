import { Metadata } from "next";
import { getLoans, getLoanSummary } from "@/actions/loans";
import { getSavingsPots } from "@/actions/savings";
import { getExpenseFundingContext } from "@/actions/expenses";
import { getOpenBudgetPeriod } from "@/actions/budget";
import { LoansClient } from "@/components/loans/loans-client";

export const metadata: Metadata = { title: "Loans — Coffer" };

export default async function LoansPage() {
  const period = await getOpenBudgetPeriod();
  const [loans, summary, savingsPots, fundingContext] = await Promise.all([
    getLoans(),
    getLoanSummary(),
    getSavingsPots(),
    getExpenseFundingContext(period.month, period.year),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <LoansClient loans={loans} summary={summary} savingsPots={savingsPots} fundingContext={fundingContext} openPeriod={period} />
    </div>
  );
}
