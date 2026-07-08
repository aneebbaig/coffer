"use client";

import { useState } from "react";
import { Target, Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  upsertInvestmentPlan,
  type InvestmentPlanCategoryInput,
  type InvestmentSuggestion,
} from "@/actions/savings";
import { cn } from "@/lib/utils";

const INVESTMENT_TYPES = [
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "STOCKS", label: "Stocks" },
  { value: "GOLD", label: "Gold" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit" },
  { value: "OTHER", label: "Other" },
];

interface PlanCategory {
  id?: string;
  name: string;
  investmentType: string;
  percentage: string;
}

interface Plan {
  monthlyTarget: number;
  autoFromSurplus: boolean;
  categories: { id: string; name: string; investmentType: string | null; percentage: number }[];
}

const fmt = (n: number) => n.toLocaleString();

function blankCategories(): PlanCategory[] {
  return [
    { name: "Money-market buffer", investmentType: "FIXED_DEPOSIT", percentage: "25" },
    { name: "Equity fund", investmentType: "MUTUAL_FUND", percentage: "40" },
    { name: "Gold", investmentType: "GOLD", percentage: "15" },
    { name: "Direct stocks", investmentType: "STOCKS", percentage: "20" },
  ];
}

export function InvestmentPlanCard({
  plan,
  suggestion,
  baseSymbol = "Rs",
}: {
  plan: Plan | null;
  suggestion: InvestmentSuggestion;
  baseSymbol?: string;
}) {
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoFromSurplus, setAutoFromSurplus] = useState(plan?.autoFromSurplus ?? true);
  const [monthlyTarget, setMonthlyTarget] = useState(plan ? String(plan.monthlyTarget / 100) : "");
  const [categories, setCategories] = useState<PlanCategory[]>(
    plan && plan.categories.length > 0
      ? plan.categories.map((c) => ({ id: c.id, name: c.name, investmentType: c.investmentType ?? "OTHER", percentage: String(c.percentage) }))
      : blankCategories(),
  );

  const pctTotal = categories.reduce((s, c) => s + (parseFloat(c.percentage) || 0), 0);

  function updateCategory(i: number, patch: Partial<PlanCategory>) {
    setCategories((cats) => cats.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addCategory() {
    setCategories((cats) => [...cats, { name: "", investmentType: "OTHER", percentage: "0" }]);
  }

  function removeCategory(i: number) {
    setCategories((cats) => cats.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (Math.round(pctTotal) !== 100) {
      toast.error(`Category split must total 100% (currently ${pctTotal}%)`);
      return;
    }
    setLoading(true);
    const payload: InvestmentPlanCategoryInput[] = categories
      .filter((c) => c.name.trim())
      .map((c) => ({ id: c.id, name: c.name, investmentType: c.investmentType, percentage: parseFloat(c.percentage) || 0 }));
    const result = await upsertInvestmentPlan({
      monthlyTarget: monthlyTarget ? parseFloat(monthlyTarget) : 0,
      autoFromSurplus,
      categories: payload,
    });
    if (result.success) {
      toast.success("Investment plan saved");
      setConfigOpen(false);
    } else toast.error(result.error ?? "Failed to save plan");
    setLoading(false);
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Investment Plan</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            {suggestion.hasPlan ? "Edit" : "Set up"}
          </Button>
        </div>

        {!suggestion.hasPlan ? (
          <p className="text-sm text-muted-foreground">
            Set a monthly contribution split (e.g. money-market buffer, equity fund, gold, direct stocks) to see a
            suggested investment amount each pay cycle and track planned vs. actual per category.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Income this cycle</p>
                <p className="font-semibold tabnum">{baseSymbol} {fmt(suggestion.monthlyIncome / 100)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Obligations due</p>
                <p className="font-semibold tabnum">{baseSymbol} {fmt(suggestion.obligationsDue / 100)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Buffer unmet</p>
                <p className="font-semibold tabnum">{baseSymbol} {fmt(suggestion.bufferUnmet / 100)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Suggested to invest</p>
                <p className="font-semibold tabnum text-emerald-500">{baseSymbol} {fmt(suggestion.suggestedTotal / 100)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {suggestion.categories.map((c) => {
                const pct = c.plannedAmount > 0 ? Math.min(100, (c.actualAmount / c.plannedAmount) * 100) : c.actualAmount > 0 ? 100 : 0;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{c.name} <span className="text-muted-foreground">({c.percentage}%)</span></span>
                      <span className="tabnum text-muted-foreground">
                        {baseSymbol} {fmt(c.actualAmount / 100)} / {baseSymbol} {fmt(c.plannedAmount / 100)}
                      </span>
                    </div>
                    <Progress value={pct} className={cn(c.actualAmount >= c.plannedAmount && c.plannedAmount > 0 && "[&>div]:bg-emerald-500")} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Investment Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-suggest from surplus</Label>
                <p className="text-xs text-muted-foreground">Income − obligations − unmet buffer</p>
              </div>
              <Switch checked={autoFromSurplus} onCheckedChange={setAutoFromSurplus} />
            </div>

            {!autoFromSurplus && (
              <div>
                <Label>Explicit monthly target ({baseSymbol})</Label>
                <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} placeholder="0" />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category split</Label>
                <span className={cn("text-xs", Math.round(pctTotal) === 100 ? "text-muted-foreground" : "text-red-500")}>
                  {pctTotal}% of 100%
                </span>
              </div>
              {categories.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Category name"
                    value={c.name}
                    onChange={(e) => updateCategory(i, { name: e.target.value })}
                    className="flex-[2]"
                  />
                  <select
                    value={c.investmentType}
                    onChange={(e) => updateCategory(i, { investmentType: e.target.value })}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {INVESTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Input
                    type="number"
                    value={c.percentage}
                    onChange={(e) => updateCategory(i, { percentage: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button variant="ghost" size="icon" onClick={() => removeCategory(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCategory}>
                <Plus className="h-3.5 w-3.5" />
                Add category
              </Button>
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              Save Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
