"use client";

import { cn } from "@/lib/utils";

export interface SavingsPot {
  id: string; name: string; color: string; icon: string;
  targetAmount: number; currentAmount: number; currentAmountUsd: number; type: string;
}

export function fmt(paisas: number) {
  return (paisas / 100).toLocaleString();
}

export function fmtUsd(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function potTotalPkr(pot: SavingsPot, rate: number) {
  return pot.currentAmount + Math.round(pot.currentAmountUsd * rate);
}

export function CurrencyPicker({ value, onChange }: { value: "PKR" | "USD"; onChange: (v: "PKR" | "USD") => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange("PKR")}
        className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
          value === "PKR" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
        )}>Rs PKR</button>
      <button type="button" onClick={() => onChange("USD")}
        className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
          value === "USD" ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:border-blue-400"
        )}>$ USD</button>
    </div>
  );
}
