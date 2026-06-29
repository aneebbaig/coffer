import type { Metadata } from "next";
import { Suspense } from "react";
import { PerfumesClient } from "@/components/perfumes/perfumes-client";
import { getPerfumes } from "@/actions/perfumes";

export const metadata: Metadata = { title: "Perfumes — Coffer" };

export default async function PerfumesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Perfumes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track your collection and shortlist what to buy next.</p>
      </div>

      <Suspense fallback={<PerfumeSkeleton />}>
        <PerfumesClient initialPerfumes={await getPerfumes()} />
      </Suspense>
    </div>
  );
}

function PerfumeSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}
