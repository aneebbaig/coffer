"use client";

import { useState } from "react";
import { Plus, Minus, PiggyBank, TrendingUp, Wallet2, ShieldCheck, AlertTriangle, DollarSign, RefreshCw, Droplets } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { addMoneyToPot, transferBetweenPots, withdrawFromPot, createSavingsPot, deleteSavingsPot } from "@/actions/savings";
import { updateUsdTopkrRate } from "@/actions/settings";
import { cn } from "@/lib/utils";
import { fmt, fmtUsd, potTotalPkr, CurrencyPicker, type SavingsPot } from "./savings-utils";
import { FundTab } from "./fund-tab";
import { InvestmentsTab } from "./investments-tab";
import { PageHeader } from "@/components/shared/page-header";

interface Goal { id: string; name: string; }
interface MonthSaving { label: string; key: string; income: number; expenses: number; surplus: number; cumulative: number; }
interface CumulativeSavings { totalAccumulated: number; months: MonthSaving[]; }
interface Investment { id: string; name: string; type: string; platform: string; investedAmount: number; currentValue: number; }

interface Props {
  pots: SavingsPot[];
  goals: Goal[];
  cumulativeSavings: CumulativeSavings;
  avgMonthlyExpenses: number;
  investments: Investment[];
  emergencyFundMonths: number;
  usdTopkrRate: number;
  totalIncome: number;
  readyToAssign: number;
  pkrAvailableForPot: number;
  usdAvailableForPot: number;
}

function ExchangeRateBanner({ rate: initialRate }: { rate: number }) {
  const [rate, setRate] = useState(initialRate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(initialRate));
  const [saving, setSaving] = useState(false);

  async function save() {
    const val = parseFloat(draft);
    if (!val || val <= 0) return;
    setSaving(true);
    const res = await updateUsdTopkrRate(val);
    setSaving(false);
    if (res.success) { setRate(val); setEditing(false); toast.success("Exchange rate updated"); }
    else toast.error(res.error ?? "Failed");
  }

  return (
    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
      <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <div className="flex-1 text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">1 USD</span> = <span className="font-bold">Rs {rate.toLocaleString()}</span>
        <span className="text-xs text-blue-500 ml-2">· auto-synced daily · used for PKR totals</span>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" step="0.01" value={draft} onChange={(e) => setDraft(e.target.value)}
            className="w-24 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900 text-sm text-blue-800 dark:text-blue-200 focus:outline-none" />
          <Button size="sm" disabled={saving} onClick={save}>{saving ? "..." : "Save"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="text-blue-600 dark:text-blue-400 h-7 px-2"
          onClick={() => { setDraft(String(rate)); setEditing(true); }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Update
        </Button>
      )}
    </div>
  );
}

function PotCard({ pot, usdTopkrRate, onAdd, onCorrect, onDelete }: {
  pot: SavingsPot; usdTopkrRate: number;
  onAdd: () => void; onCorrect: () => void; onDelete: () => void;
}) {
  const hasPkr = pot.currentAmount > 0;
  const hasUsd = pot.currentAmountUsd > 0;
  const totalPkrForPot = potTotalPkr(pot, usdTopkrRate);
  const pct = pot.targetAmount > 0 ? Math.round((totalPkrForPot / pot.targetAmount) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: pot.color }}>
          <PiggyBank className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{pot.name}</div>
          <div className="text-xs text-muted-foreground">{pot.type}</div>
        </div>
      </div>
      <div className="mb-2">
        {hasUsd && (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">$ {fmtUsd(pot.currentAmountUsd)}</span>
            <span className="text-xs text-blue-400">≈ Rs {fmt(Math.round(pot.currentAmountUsd * usdTopkrRate))}</span>
          </div>
        )}
        {hasPkr && <div className="text-xl font-bold text-foreground">Rs {fmt(pot.currentAmount)}</div>}
        {!hasPkr && !hasUsd && <div className="text-xl font-bold text-muted-foreground">Rs 0</div>}
        {hasPkr && hasUsd && <div className="text-xs text-muted-foreground font-medium mt-0.5">Total ≈ Rs {fmt(totalPkrForPot)}</div>}
      </div>
      {pot.targetAmount > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-2">{pct}% of Rs {fmt(pot.targetAmount)} goal</div>
          <Progress value={Math.min(pct, 100)} className="h-2 mb-3" />
        </>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add
        </Button>
        <Button size="sm" variant="outline" onClick={onCorrect}>
          <Minus className="h-3.5 w-3.5 mr-1" />Correct
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={onDelete}>✕</Button>
      </div>
    </div>
  );
}

export function SavingsClient({ pots, goals: _goals, cumulativeSavings, avgMonthlyExpenses, investments, emergencyFundMonths, usdTopkrRate, totalIncome, readyToAssign, pkrAvailableForPot, usdAvailableForPot }: Props) {
  const [potDialog, setPotDialog] = useState<{ type: "add" | "correct" | "new" | null; potId?: string }>({ type: null });
  const [amount, setAmount] = useState("");
  const [potCurrency, setPotCurrency] = useState<"PKR" | "USD">("PKR");
  const [potSourceType, setPotSourceType] = useState<"income" | "pot" | "manual">("income");
  const [potSourcePotId, setPotSourcePotId] = useState("");
  const [correctNote, setCorrectNote] = useState("");
  const [newPot, setNewPot] = useState({ name: "", targetAmount: "", color: "#3b82f6", type: "GENERAL" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const regularPots = pots.filter((p) => p.type !== "EMERGENCY" && p.type !== "LIQUID");
  const activePot = potDialog.potId ? pots.find((p) => p.id === potDialog.potId) : null;

  const totalAllPotsPkr = pots.reduce((s, p) => s + potTotalPkr(p, usdTopkrRate), 0);
  const totalUsdCentsAll = pots.reduce((s, p) => s + p.currentAmountUsd, 0);
  const regularTotalPkr = regularPots.reduce((s, p) => s + potTotalPkr(p, usdTopkrRate), 0);
  const regularUsdCents = regularPots.reduce((s, p) => s + p.currentAmountUsd, 0);

  const emergencyPots = pots.filter((p) => p.type === "EMERGENCY");
  const liquidPots = pots.filter((p) => p.type === "LIQUID");
  const emergencyTotalPkr = emergencyPots.reduce((s, p) => s + potTotalPkr(p, usdTopkrRate), 0);
  const liquidTotalPkr = liquidPots.reduce((s, p) => s + potTotalPkr(p, usdTopkrRate), 0);
  const efMonthsCovered = avgMonthlyExpenses > 0 ? emergencyTotalPkr / avgMonthlyExpenses : 0;
  const efTarget = avgMonthlyExpenses * emergencyFundMonths;
  const efPct = efTarget > 0 ? Math.min(100, Math.round((emergencyTotalPkr / efTarget) * 100)) : 0;
  const efStatus: "critical" | "low" | "ok" | "safe" =
    efMonthsCovered < 3 ? "critical" :
    efMonthsCovered < emergencyFundMonths * 0.5 ? "low" :
    efMonthsCovered < emergencyFundMonths ? "ok" : "safe";

  const { months } = cumulativeSavings;

  async function handlePotAction() {
    if (!potDialog.potId || !amount) return;
    if (potSourceType === "pot" && !potSourcePotId) return;
    setLoading(true);
    const n = parseFloat(amount);
    const result = potSourceType === "pot"
      ? await transferBetweenPots(potSourcePotId, potDialog.potId, n, potCurrency)
      : await addMoneyToPot(potDialog.potId, n, potCurrency, "From income", potSourceType === "manual" ? "MANUAL" : "INCOME");
    if (result.success) {
      toast.success("Money added!");
      setPotDialog({ type: null }); setAmount(""); setPotCurrency("PKR"); setPotSourceType("income"); setPotSourcePotId("");
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleCorrect() {
    if (!potDialog.potId || !amount) return;
    setLoading(true);
    const n = parseFloat(amount);
    const result = await withdrawFromPot(potDialog.potId, n, potCurrency, correctNote || "Balance correction");
    if (result.success) {
      toast.success("Balance corrected");
      setPotDialog({ type: null }); setAmount(""); setPotCurrency("PKR"); setCorrectNote("");
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleCreatePot() {
    if (!newPot.name) return;
    setLoading(true);
    const result = await createSavingsPot({
      name: newPot.name,
      icon: "PiggyBank",
      color: newPot.color,
      targetAmount: parseFloat(newPot.targetAmount) || 0,
      type: newPot.type,
    });
    if (result.success) { toast.success("Pot created!"); setPotDialog({ type: null }); setNewPot({ name: "", targetAmount: "", color: "#3b82f6", type: "GENERAL" }); }
    else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  return (
    <>
    <PageHeader section="Savings & Wealth" title="Savings" />
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="emergency">Emergency Fund</TabsTrigger>
        <TabsTrigger value="liquid">Liquid Savings</TabsTrigger>
        <TabsTrigger value="pots">Savings Pots</TabsTrigger>
        <TabsTrigger value="investments">Investments</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <ExchangeRateBanner rate={usdTopkrRate} />

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Total in all pots</span>
            <div className="p-2 rounded-lg bg-muted text-primary"><PiggyBank className="h-4 w-4" /></div>
          </div>
          <div className="text-3xl font-bold text-foreground">Rs {fmt(totalAllPotsPkr)}</div>
          {totalUsdCentsAll > 0 && <div className="text-sm text-muted-foreground mt-0.5">incl. $ {fmtUsd(totalUsdCentsAll)} USD</div>}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Emergency", value: `Rs ${fmt(emergencyTotalPkr)}` },
              { label: "Liquid", value: `Rs ${fmt(liquidTotalPkr)}` },
              { label: "Savings", value: `Rs ${fmt(regularTotalPkr)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                <div className="text-sm font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {emergencyPots.length > 0 && avgMonthlyExpenses > 0 && (
          <div className={cn("rounded-xl border p-4", {
            "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800": efStatus === "critical",
            "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800": efStatus === "low",
            "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800": efStatus === "ok",
            "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800": efStatus === "safe",
          })}>
            <div className="flex items-center gap-3">
              {efStatus === "safe" || efStatus === "ok"
                ? <ShieldCheck className={cn("h-5 w-5 shrink-0", efStatus === "safe" ? "text-emerald-600" : "text-blue-600")} />
                : <AlertTriangle className={cn("h-5 w-5 shrink-0", efStatus === "critical" ? "text-red-600" : "text-amber-600")} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">Emergency Fund</div>
                <div className="text-xs text-muted-foreground">{efMonthsCovered.toFixed(1)} of {emergencyFundMonths} months · {efPct}% funded</div>
              </div>
              <div className={cn("text-lg font-bold shrink-0", {
                "text-red-600": efStatus === "critical", "text-amber-600": efStatus === "low",
                "text-blue-600": efStatus === "ok", "text-emerald-600": efStatus === "safe",
              })}>{efPct}%</div>
            </div>
            <div className="mt-2 w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
              <div className={cn("h-2 rounded-full transition-all", {
                "bg-red-500": efStatus === "critical", "bg-amber-500": efStatus === "low",
                "bg-blue-500": efStatus === "ok", "bg-emerald-500": efStatus === "safe",
              })} style={{ width: `${efPct}%` }} />
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This month</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-3">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-0.5">Income</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Rs {fmt(totalIncome)}</div>
            </div>
            <div className={cn("rounded-xl p-3", readyToAssign >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950")}>
              <div className={cn("text-xs mb-0.5", readyToAssign >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>Ready to assign</div>
              <div className={cn("text-xl font-bold", readyToAssign >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>Rs {fmt(readyToAssign)}</div>
            </div>
          </div>
        </div>

        {months.length === 0 ? (
          <EmptyState icon={Wallet2} title="No transaction history" description="Add income and expenses to see your monthly trend." />
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent months</div>
            {[...months].reverse().slice(0, 3).map((m) => (
              <div key={m.key} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{m.label}</div>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-emerald-600">+Rs {fmt(m.income)}</span>
                    <span className="text-xs text-red-500">-Rs {fmt(m.expenses)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-sm font-bold", m.surplus >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {m.surplus >= 0 ? "+" : ""}Rs {fmt(m.surplus)}
                  </div>
                  <div className="text-xs text-muted-foreground">saved</div>
                </div>
              </div>
            ))}
            {months.length > 3 && <p className="text-xs text-center text-muted-foreground pt-1">{months.length - 3} older months not shown</p>}
          </div>
        )}
      </TabsContent>

      <TabsContent value="emergency" className="mt-4">
        <FundTab pots={pots} potType="EMERGENCY" label="Emergency Fund" icon={ShieldCheck}
          avgMonthlyExpenses={avgMonthlyExpenses} emergencyFundMonths={emergencyFundMonths}
          usdTopkrRate={usdTopkrRate} totalIncome={totalIncome} readyToAssign={readyToAssign}
          pkrAvailableForPot={pkrAvailableForPot} usdAvailableForPot={usdAvailableForPot}
          onDelete={setDeleteId} />
      </TabsContent>

      <TabsContent value="liquid" className="mt-4">
        <FundTab pots={pots} potType="LIQUID" label="Liquid Savings" icon={Droplets}
          avgMonthlyExpenses={avgMonthlyExpenses} emergencyFundMonths={emergencyFundMonths}
          usdTopkrRate={usdTopkrRate} totalIncome={totalIncome} readyToAssign={readyToAssign}
          pkrAvailableForPot={pkrAvailableForPot} usdAvailableForPot={usdAvailableForPot}
          onDelete={setDeleteId} />
      </TabsContent>

      <TabsContent value="pots" className="mt-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-xs text-muted-foreground">Total in savings pots (PKR eq.)</div>
            <div className="text-2xl font-bold text-foreground">Rs {fmt(regularTotalPkr)}</div>
            {regularUsdCents > 0 && <div className="text-xs text-blue-500 mt-0.5">incl. $ {fmtUsd(regularUsdCents)} USD</div>}
          </div>
          <Button onClick={() => setPotDialog({ type: "new" })}>
            <Plus className="h-4 w-4 mr-2" />New Pot
          </Button>
        </div>

        {regularPots.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No savings pots"
            description="Create pots for goals or any savings bucket. Emergency and Liquid funds are on their own tabs."
            action={{ label: "Create a pot", onClick: () => setPotDialog({ type: "new" }) }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regularPots.map((pot) => (
              <PotCard key={pot.id} pot={pot} usdTopkrRate={usdTopkrRate}
                onAdd={() => { setPotDialog({ type: "add", potId: pot.id }); setAmount(""); setPotCurrency("PKR"); setPotSourceType("income"); setPotSourcePotId(""); }}
                onCorrect={() => { setPotDialog({ type: "correct", potId: pot.id }); setAmount(""); setPotCurrency("PKR"); setCorrectNote(""); }}
                onDelete={() => setDeleteId(pot.id)} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="investments" className="mt-4">
        <InvestmentsTab investments={investments} />
      </TabsContent>

      <Dialog open={potDialog.type === "add"} onOpenChange={(o) => !o && setPotDialog({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Money - {activePot?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="flex gap-2">
                {(["income", "pot", "manual"] as const).map((src) => (
                  <button key={src} type="button" onClick={() => setPotSourceType(src)}
                    disabled={src === "pot" && pots.filter((p) => p.id !== activePot?.id).length === 0}
                    className={cn("flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors",
                      potSourceType === src ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary",
                      src === "pot" && pots.filter((p) => p.id !== activePot?.id).length === 0 && "opacity-50 cursor-not-allowed"
                    )}>{src === "income" ? "Monthly income" : src === "pot" ? "Transfer from pot" : "Manual"}</button>
                ))}
              </div>
              {potSourceType === "manual" && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Use for corrections (e.g. re-adding after an over-deduction) or money from outside your tracked income. No income validation applied.
                </div>
              )}
              {potSourceType === "income" && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs space-y-0.5">
                  {potCurrency === "USD" ? (
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
              {potSourceType === "pot" && (
                <select value={potSourcePotId} onChange={(e) => setPotSourcePotId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm">
                  <option value="">Select a pot…</option>
                  {pots.filter((p) => p.id !== activePot?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} - Rs {fmt(p.currentAmount)}{p.currentAmountUsd > 0 ? ` / $${fmtUsd(p.currentAmountUsd)}` : ""}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencyPicker value={potCurrency} onChange={setPotCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ({potCurrency === "USD" ? "$" : "Rs"})</Label>
              <Input type="number" placeholder={potCurrency === "USD" ? "Amount ($)" : "Amount (Rs)"}
                value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
              {potCurrency === "USD" && amount && (
                <p className="text-xs text-blue-600 dark:text-blue-400">≈ Rs {(parseFloat(amount) * usdTopkrRate).toLocaleString()} at Rs {usdTopkrRate.toLocaleString()}/USD</p>
              )}
            </div>
            <Button className="w-full" onClick={handlePotAction} disabled={loading || !amount || (potSourceType === "pot" && !potSourcePotId)}>
              Add Money
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={potDialog.type === "correct"} onOpenChange={(o) => !o && setPotDialog({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Correct Balance - {activePot?.name}</DialogTitle></DialogHeader>
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
              <CurrencyPicker value={potCurrency} onChange={setPotCurrency} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount to remove ({potCurrency === "USD" ? "$" : "Rs"})</Label>
              <Input type="number" placeholder={potCurrency === "USD" ? "Amount ($)" : "Amount (Rs)"}
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

      <Dialog open={potDialog.type === "new"} onOpenChange={(o) => !o && setPotDialog({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Savings Pot</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newPot.name} onChange={(e) => setNewPot((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Holiday, New Car, MacBook…" />
            </div>
            <div className="space-y-1.5">
              <Label>Target Amount (Rs) <span className="text-muted-foreground font-normal text-xs">optional</span></Label>
              <Input type="number" value={newPot.targetAmount} onChange={(e) => setNewPot((p) => ({ ...p, targetAmount: e.target.value }))} placeholder="0" />
              <p className="text-xs text-muted-foreground">Target in PKR. You can add both PKR and USD amounts after creating.</p>
            </div>
            <div className="flex items-center gap-3">
              <Label>Color</Label>
              <input type="color" value={newPot.color} onChange={(e) => setNewPot((p) => ({ ...p, color: e.target.value }))} className="w-10 h-8 rounded cursor-pointer border border-border" />
            </div>
            <Button className="w-full" onClick={handleCreatePot} disabled={loading || !newPot.name}>
              {loading ? "Creating..." : "Create Pot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete pot?" description="All history will be permanently deleted."
        onConfirm={async () => {
          const result = await deleteSavingsPot(deleteId!);
          if (result.success) toast.success("Deleted");
          else toast.error(result.error ?? "Failed");
          setDeleteId(null);
        }} />
    </Tabs>
    </>
  );
}
