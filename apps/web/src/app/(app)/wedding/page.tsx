import { Metadata } from "next";
import { getWeddingPlans } from "@/actions/wedding";
import { WeddingClient } from "@/components/wedding/wedding-client";

export const metadata: Metadata = { title: "Wedding" };

export default async function WeddingPage() {
  const plans = await getWeddingPlans();

  return (
    <div className="max-w-5xl mx-auto">
      <WeddingClient plans={plans as any} />
    </div>
  );
}
