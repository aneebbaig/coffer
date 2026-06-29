import { Metadata } from "next";
import { getCurrentPeriod, prevPeriod } from "@/lib/month";
import { getTransactions, getMonthlySummary, getExpenseFundingContext } from "@/actions/expenses";
import { getCategories, getUserSettings } from "@/actions/settings";
import { IncomeClient } from "@/components/income/income-client";

export const metadata: Metadata = { title: "Income — Coffer" };

export default async function IncomePage() {
  const [transactions, categories, settings] = await Promise.all([
    getTransactions({ type: "INCOME" }),
    getCategories(),
    getUserSettings(),
  ]);
  const { month, year } = getCurrentPeriod(settings?.currentBudgetMonth, settings?.currentBudgetYear);
  const last = prevPeriod(month, year);

  const [monthlySummary, fundingCtx] = await Promise.all([
    getMonthlySummary(month, year),
    getExpenseFundingContext(month, year),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <IncomeClient
        transactions={transactions}
        categories={categories}
        dateFormat={settings?.dateFormat ?? "dd/MM/yyyy"}
        usdTopkrRate={settings?.usdTopkrRate ?? 278}
        thisMonthIncome={monthlySummary.totalIncome}
        monthlyAvailable={fundingCtx.monthlyIncomeAvailable}
        currentPeriod={{ month, year }}
        lastPeriod={last}
      />
    </div>
  );
}
