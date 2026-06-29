"use client";

import { useState } from "react";
import { Plus, Minus, ShieldCheck, AlertTriangle, Shield, Droplets } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMoneyToPot, transferBetweenPots, withdrawFromPot, createSavingsPot } from "@/actions/savings";
import { updateEmergencyFundMonths } from "@/actions/settings";
import { cn } from "@/lib/utils";
import { fmt, fmtUsd, potTotalPkr, CurrencyPicker, type SavingsPot } from "./savings-utils";

interface FundTabProps {
  pots: SavingsPot[];
  potType: "EMERGENCY" | "LIQUID";
  label: string;
  icon: React.ElementType;
  avgMonthlyExpenses: number;
  emergencyFundMonths: number;
  usdTopkrRate: number;
  totalIncome: number;
  readyToAssign: number;
  pkrAvailableForPot: number;
  usdAvailableForPot: number;
  onDelete: (id: string) => void;
}

export function FundTab({
  pots, potType, label, icon: Icon,
  avgMonthlyExpenses, emergencyFundMonths, usdTopkrRate,
  totalIncome, readyToAssign: _readyToAssign, pkrAvailableForPot, usdAvailableForPot, onDelete,
}: FundTabProps) {
  const [potDialog, setPotDialog] = useState<{ type: "add" | "correct" | null; potId?: string }>({ type: null });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"PKR" | "USD">("PKR");
  const [sourceType, setSourceType] = useState<"income" | "pot" | "manual">("income");
  const [sourcePotId, setSourcePotId] = useState("");
  const [correctNote, setCorrectNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(emergencyFundMonths);
  const [editingMonths, setEditingMonths] = useState(false);
  const [savingMonths, setSavingMonths] = useState(false);
  const [creatingPot, setCreatingPot] = useState(false);

  const fundPots = pots.filter((p) => p.type === potType);
  const totalPkr = fundPots.reduce((s, p) => s + potTotalPkr(p, usdTopkrRate), 0);
  const totalUsdCents = fundPots.reduce((s, p) => s + p.currentAmountUsd, 0);
  const totalPkrOnly = fundPots.reduce((s, p) => s + p.currentAmount, 0);

  const isEmergency = potType === "EMERGENCY";
  const targetAmount = isEmergency ? avgMonthlyExpenses * months : 0;
  const monthsCovered = avgMonthlyExpenses > 0 ? totalPkr / avgMonthlyExpenses : 0;
  const pct = targetAmount > 0 ? Math.min(100, (totalPkr / targetAmount) * 100) : 0;

  let status: "critical" | "low" | "ok" | "safe" = "safe";
  if (isEmergency) {
    if (monthsCovered < 3) status = "critical";
    else if (monthsCovered < months * 0.5) status = "low";
    else if (monthsCovered < months) status = "ok";
    else status = "safe";
  }

  const activePot = potDialog.potId ? pots.find((p) => p.id === potDialog.potId) : null;
  const transferablePots = pots.filter((p) => p.type !== potType);

  async function handleSaveMonths(newMonths: number) {
    setSavingMonths(true);
    const result = await updateEmergencyFundMonths(newMonths);
    setSavingMonths(false);
    if (result.success) { setMonths(newMonths); setEditingMonths(false); toast.success("Target updated"); }
    else toast.error("Failed to update");
  }

  async function handleCreatePot() {
    setCreatingPot(true);
    const result = await createSavingsPot({
      name: isEmergency ? "Emergency Fund" : "Liquid Savings",
      icon: isEmergency ? "Shield" : "Droplets",
      color: isEmergency ? "#10b981" : "#3b82f6",
      targetAmount: 0,
      type: potType,
    });
    setCreatingPot(false);
    if (result.success) toast.success(`${label} pot created!`);
    else toast.error(result.error ?? "Failed");
  }

  async function handleCorrect() {
    if (!potDialog.potId || !amount) return;
    setLoading(true);
    const n = parseFloat(amount);
    const result = await withdrawFromPot(potDialog.potId, n, currency, correctNote || "Balance correction");
    if (result.success) {
      toast.success("Balance corrected");
      setPotDialog({ type: null }); setAmount(""); setCurrency("PKR"); setCorrectNote("");
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handlePotAction() {
    if (!potDialog.potId || !amount) return;
    if (sourceType === "pot" && !sourcePotId) return;
    setLoading(true);
    const n = parseFloat(amount);
    const result = sourceType === "pot"
      ? await transferBetweenPots(sourcePotId, potDialog.potId, n, currency)
      : await addMoneyToPot(potDialog.potId, n, currency, "From income", sourceType === "manual" ? "MANUAL" : "INCOME");
    if (result.success) {
      toast.success("Money added!");
      setPotDialog({ type: null }); setAmount(""); setCurrency("PKR"); setSourceType("income"); setSourcePotId("");
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  if (avgMonthlyExpenses === 0 && isEmergency) {
    return (
      <div className="bg-muted/40 border border-border rounded-xl p-6 text-center space-y-2">
        <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-foreground">No expense data yet</p>
        <p className="text-xs text-muted-foreground">Add expense transactions to calculate your emergency fund target.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isEmergency && (
        <div className={cn(
          "rounded-xl border p-5 space-y-4",
          status === "critical" ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" :
          status === "low" ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" :
          status === "ok" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" :
          "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
        )}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {status === "safe" || status === "ok"
                ? <ShieldCheck className={cn("h-5 w-5", status === "safe" ? "text-emerald-600" : "text-blue-600")} />
                : <AlertTriangle className={cn("h-5 w-5", status === "critical" ? "text-red-600" : "text-amber-600")} />}
              <span className="font-semibold text-foreground">Emergency Fund</span>
            </div>
            <span className={cn("text-xs font-medium px-2 py-1 rounded-full bg-white/60 dark:bg-black/20",
              status === "critical" ? "text-red-600" : status === "low" ? "text-amber-600" :
              status === "ok" ? "text-blue-600" : "text-emerald-600"
            )}>
              {status === "critical" ? "Critical — under 3 months" :
               status === "low" ? `Low — building toward ${months} months` :
               status === "ok" ? "Building — almost there" : `Safe — ${months}+ months covered`}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-foreground text-lg">{monthsCovered.toFixed(1)} months covered</span>
              <span className="text-muted-foreground">Goal: {months} months</span>
            </div>
            <div className="w-full bg-white/60 dark:bg-black/20 rounded-full h-4 overflow-hidden">
              <div className={cn("h-4 rounded-full transition-all",
                status === "critical" ? "bg-red-500" : status === "low" ? "bg-amber-500" :
                status === "ok" ? "bg-blue-500" : "bg-emerald-500"
              )} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Rs {fmt(totalPkr)} total (PKR eq.)</span>
              <span>Rs {fmt(targetAmount)} needed</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Monthly avg", value: `Rs ${fmt(avgMonthlyExpenses)}` },
              { label: `Target (${months} mo)`, value: `Rs ${fmt(targetAmount)}` },
              { label: "Still needed", value: totalPkr >= targetAmount ? "✓ Done" : `Rs ${fmt(targetAmount - totalPkr)}` },
            ].map(({ label: l, value }) => (
              <div key={l} className="bg-white/60 dark:bg-black/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{l}</div>
                <div className="text-sm font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isEmergency && fundPots.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Liquid Savings</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">Rs {fmt(totalPkr)}</div>
          {totalUsdCents > 0 && (
            <div className="text-xs text-blue-500 mt-0.5">$ {fmtUsd(totalUsdCents)} + Rs {fmt(totalPkrOnly)} combined</div>
          )}
          <p className="text-xs text-muted-foreground mt-1">For unplanned expenses — tap from here when over budget</p>
        </div>
      )}

      {isEmergency && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Target: {months} months of expenses</div>
            <div className="text-xs text-muted-foreground">Recommended: 3–6 months minimum, 9–12 for security</div>
          </div>
          {editingMonths ? (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={24} defaultValue={months} className="w-20 h-8 text-sm" id="ef-months"
                onKeyDown={(e) => { if (e.key === "Enter") { const v = parseInt((e.target as HTMLInputElement).value); if (v >= 1 && v <= 24) handleSaveMonths(v); } }}
              />
              <Button size="sm" disabled={savingMonths} onClick={() => { const el = document.getElementById("ef-months") as HTMLInputElement; const v = parseInt(el?.value ?? "6"); if (v >= 1 && v <= 24) handleSaveMonths(v); }}>
                {savingMonths ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingMonths(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditingMonths(true)}>Change</Button>
          )}
        </div>
      )}

      {fundPots.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center space-y-3">
          <Icon className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">No {label.toLowerCase()} pot yet</p>
          <Button onClick={handleCreatePot} disabled={creatingPot}>{creatingPot ? "Setting up…" : `Set Up ${label}`}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fundPots.map((pot) => {
            const hasPkr = pot.currentAmount > 0;
            const hasUsd = pot.currentAmountUsd > 0;
            const totalPkrForPot = potTotalPkr(pot, usdTopkrRate);
            return (
              <div key={pot.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{pot.name}</div>
                    {hasUsd && (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">$ {fmtUsd(pot.currentAmountUsd)}</span>
                        <span className="text-sm text-blue-400">≈ Rs {fmt(Math.round(pot.currentAmountUsd * usdTopkrRate))}</span>
                      </div>
                    )}
                    {hasPkr && <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Rs {fmt(pot.currentAmount)}</div>}
                    {hasPkr && hasUsd && <div className="text-xs text-muted-foreground mt-0.5 font-medium">Total ≈ Rs {fmt(totalPkrForPot)}</div>}
                    {!hasPkr && !hasUsd && <div className="text-2xl font-bold text-muted-foreground">Rs 0</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" onClick={() => { setPotDialog({ type: "add", potId: pot.id }); setAmount(""); setCurrency("PKR"); setSourceType("income"); setSourcePotId(""); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setPotDialog({ type: "correct", potId: pot.id }); setAmount(""); setCurrency("PKR"); setCorrectNote(""); }}>
                      <Minus className="h-3.5 w-3.5 mr-1" />Correct
                    </Button>
                    <span className="text-xs text-muted-foreground">Spend → create expense, pick pot as source</span>
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => onDelete(pot.id)}>✕</Button>
                  </div>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={handleCreatePot} disabled={creatingPot}>
            <Plus className="h-3.5 w-3.5 mr-1" />{creatingPot ? "Creating…" : `Add Another ${label} Pot`}
          </Button>
        </div>
      )}

      <Dialog open={potDialog.type === "add"} onOpenChange={(o) => !o && setPotDialog({ type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to {activePot?.name ?? label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSourceType("income")}
                  className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    sourceType === "income" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                  )}>Monthly income</button>
                <button type="button" onClick={() => setSourceType("pot")} disabled={transferablePots.length === 0}
                  className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    sourceType === "pot" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary",
                    transferablePots.length === 0 && "opacity-50 cursor-not-allowed"
                  )}>Transfer from pot</button>
                <button type="button" onClick={() => setSourceType("manual")}
                  className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    sourceType === "manual" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                  )}>Manual</button>
              </div>
              {sourceType === "manual" && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Use for corrections (e.g. re-adding after an over-deduction) or money from outside your tracked income. No income validation applied.
                </div>
              )}
              {sourceType === "income" && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs space-y-0.5">
                  {currency === "USD" ? (
                    <div className={cn("flex justify-between font-semibold", usdAvailableForPot > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400")}>
                      <span>Available from income</span><span>$ {fmtUsd(usdAvailableForPot)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                        <span>This month&apos;s income</span><span className="font-semibold">Rs {fmt(totalIncome)}</span>
                      </div>
                      <div className={cn("flex justify-between font-semibold", pkrAvailableForPot > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400")}>
                        <span>Available from income</span><span>Rs {fmt(pkrAvailableForPot)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              {sourceType === "pot" && (
                <select value={sourcePotId} onChange={(e) => setSourcePotId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm">
                  <option value="">Select a pot…</option>
                  {transferablePots.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — Rs {fmt(p.currentAmount)}{p.currentAmountUsd > 0 ? ` / $${fmtUsd(p.currentAmountUsd)}` : ""}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ({currency === "USD" ? "$" : "Rs"})</Label>
              <Input type="number" placeholder={currency === "USD" ? "Amount ($)" : "Amount (Rs)"}
                value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
              {currency === "USD" && amount && (
                <p className="text-xs text-blue-600">≈ Rs {(parseFloat(amount) * usdTopkrRate).toLocaleString()} at Rs {usdTopkrRate.toLocaleString()}/USD</p>
              )}
            </div>
            <Button className="w-full" onClick={handlePotAction} disabled={loading || !amount || (sourceType === "pot" && !sourcePotId)}>
              Add Money
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={potDialog.type === "correct"} onOpenChange={(o) => !o && setPotDialog({ type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Balance — {activePot?.name ?? label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs space-y-0.5">
              {activePot && activePot.currentAmount > 0 && (
                <div className="flex justify-between text-foreground">
                  <span>Current PKR balance</span><span className="font-semibold">Rs {fmt(activePot.currentAmount)}</span>
                </div>
              )}
              {activePot && activePot.currentAmountUsd > 0 && (
                <div className="flex justify-between text-foreground">
                  <span>Current USD balance</span><span className="font-semibold">$ {fmtUsd(activePot.currentAmountUsd)}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount to remove ({currency === "USD" ? "$" : "Rs"})</Label>
              <Input type="number" placeholder={currency === "USD" ? "Amount ($)" : "Amount (Rs)"}
                value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal text-xs">optional</span></Label>
              <Input placeholder="e.g. Spent on car repair, balance error fix…"
                value={correctNote} onChange={(e) => setCorrectNote(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full" onClick={handleCorrect} disabled={loading || !amount}>
              <Minus className="h-4 w-4 mr-2" />{loading ? "Removing…" : "Remove Amount"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
