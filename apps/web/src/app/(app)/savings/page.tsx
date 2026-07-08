import { Metadata } from "next";
import { getCurrentPeriod } from "@/lib/month";
import { getSavingsPots, getCumulativeSavings, getAverageMonthlyExpenses, getInvestments, getIncomeAvailableForPot, getFinancialPosition } from "@/actions/savings";
import { getGoals } from "@/actions/goals";
import { getUserSettings } from "@/actions/settings";
import { getReadyToAssign } from "@/actions/budget";
import { getCurrencies } from "@/lib/currency-helpers";
import { SavingsClient } from "@/components/savings/savings-client";

export const metadata: Metadata = { title: "Savings" };

export default async function SavingsPage() {
  const settings = await getUserSettings();
  const { month, year } = getCurrentPeriod(settings?.currentBudgetMonth, settings?.currentBudgetYear);

  const [pots, currencies, goals, cumulativeSavings, avgMonthlyExpenses, investments, incomeData, potAvailable, financialPosition] = await Promise.all([
    getSavingsPots(),
    getCurrencies(),
    getGoals(),
    getCumulativeSavings(),
    getAverageMonthlyExpenses(),
    getInvestments(),
    getReadyToAssign(month, year),
    getIncomeAvailableForPot(),
    getFinancialPosition(),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <SavingsClient
        pots={pots}
        currencies={currencies}
        goals={goals}
        cumulativeSavings={cumulativeSavings}
        avgMonthlyExpenses={avgMonthlyExpenses}
        investments={investments}
        emergencyFundMonths={settings?.emergencyFundMonths ?? 6}
        totalIncome={incomeData.totalIncome}
        readyToAssign={incomeData.readyToAssign}
        incomeAvailability={potAvailable.perCurrency}
        liquidAvailable={financialPosition.liquidAvailable}
      />
    </div>
  );
}
