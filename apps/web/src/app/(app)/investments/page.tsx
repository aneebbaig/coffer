import { Metadata } from "next";
import { getInvestments } from "@/actions/savings";
import { InvestmentsClient } from "@/components/investments/investments-client";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const investments = await getInvestments();

  return (
    <div className="max-w-5xl mx-auto">
      <InvestmentsClient investments={investments} />
    </div>
  );
}
