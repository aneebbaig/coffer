import { Metadata } from "next";
import { getInvestments } from "@/actions/savings";
import { getCurrencies } from "@/lib/currency-helpers";
import { InvestmentsClient } from "@/components/investments/investments-client";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const [investments, currencies] = await Promise.all([getInvestments(), getCurrencies()]);
  const baseSymbol = currencies.find((c) => c.isBase)?.symbol ?? "Rs";

  return (
    <div className="max-w-5xl mx-auto">
      <InvestmentsClient investments={investments} baseSymbol={baseSymbol} />
    </div>
  );
}
