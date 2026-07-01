import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurprise } from "@/actions/vault";
import { VaultDetailClient } from "@/components/vault/vault-detail-client";

export const metadata: Metadata = { title: "Surprise Detail" };

export default async function VaultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surprise = await getSurprise(id);
  if (!surprise) notFound();

  return <VaultDetailClient surprise={surprise} />;
}
