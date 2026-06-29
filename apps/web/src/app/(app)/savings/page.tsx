import { Metadata } from "next";
import { getCurrentPeriod } from "@/lib/month";
import { getSavingsPots, getCumulativeSavings, getAverageMonthlyExpenses, getInvestments, getIncomeAvailableForPot } from "@/actions/savings";
import { getGoals } from "@/actions/goals";
import { getUserSettings } from "@/actions/settings";
import { getReadyToAssign } from "@/actions/budget";
import { SavingsClient } from "@/components/savings/savings-client";

export const metadata: Metadata = { title: "Savings — Coffer" };

export default async function SavingsPage() {
  const settings = await getUserSettings();
  const { month, year } = getCurrentPeriod(settings?.currentBudgetMonth, settings?.currentBudgetYear);

  const [pots, goals, cumulativeSavings, avgMonthlyExpenses, investments, incomeData, potAvailable] = await Promise.all([
    getSavingsPots(),
    getGoals(),
    getCumulativeSavings(),
    getAverageMonthlyExpenses(),
    getInvestments(),
    getReadyToAssign(month, year),
    getIncomeAvailableForPot(),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <SavingsClient
        pots={pots}
        goals={goals}
        cumulativeSavings={cumulativeSavings}
        avgMonthlyExpenses={avgMonthlyExpenses}
        investments={investments}
        emergencyFundMonths={settings?.emergencyFundMonths ?? 6}
        usdTopkrRate={settings?.usdTopkrRate ?? 278}
        totalIncome={incomeData.totalIncome}
        readyToAssign={incomeData.readyToAssign}
        pkrAvailableForPot={potAvailable.pkrAvailable}
        usdAvailableForPot={potAvailable.usdAvailable}
      />
    </div>
  );
}
