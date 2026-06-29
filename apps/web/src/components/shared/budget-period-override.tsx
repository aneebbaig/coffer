"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getMonthName } from "@/lib/utils";

export interface PeriodOverride {
  enabled: boolean;
  month: number;
  year: number;
}

/**
 * Shared control for filing a transaction under a budget month other than the open period.
 * Default: off → the action uses the user's open period. Reused by the expense form and the
 * loan-repayment form so the override exists in exactly one place.
 */
export function BudgetPeriodOverride({
  openPeriod,
  value,
  onChange,
}: {
  openPeriod: { month: number; year: number };
  value: PeriodOverride;
  onChange: (v: PeriodOverride) => void;
}) {
  const monthStr = `${value.year}-${String(value.month).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="periodOverride"
          checked={value.enabled}
          onCheckedChange={(c) => onChange({ ...value, enabled: !!c })}
        />
        <Label htmlFor="periodOverride" className="cursor-pointer text-sm">
          File under a specific budget month
        </Label>
      </div>
      {value.enabled ? (
        <Input
          type="month"
          value={monthStr}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            if (y && m) onChange({ ...value, year: y, month: m });
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Counts toward the open month — {getMonthName(openPeriod.month)} {openPeriod.year}.
        </p>
      )}
    </div>
  );
}
