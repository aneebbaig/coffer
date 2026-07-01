import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWeddingPlan } from "@/actions/wedding";
import { WeddingDetailClient } from "@/components/wedding/wedding-detail-client";

export const metadata: Metadata = { title: "Wedding Plan" };

export default async function WeddingPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getWeddingPlan(id);
  if (!plan) notFound();

  return (
    <div className="max-w-5xl mx-auto">
      <WeddingDetailClient plan={plan as any} />
    </div>
  );
}
