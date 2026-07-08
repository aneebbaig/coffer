"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, TrendingUp, TrendingDown, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createLoan, recordPayment, deleteLoan } from "@/actions/loans";
import { BudgetPeriodOverride, type PeriodOverride } from "@/components/shared/budget-period-override";
import { SplitFunding, type FundingOption } from "@/components/shared/split-funding";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

interface LoanPayment { id: string; amount: number; date: Date; notes: string | null; }
interface Loan {
  id: string; personName: string; description: string | null; type: string;
  principalAmount: number; remainingAmount: number; date: Date; dueDate: Date | null;
  notes: string | null; status: string; payments: LoanPayment[];
}
interface Summary { totalGiven: number; totalReceived: number; netPosition: number; }
interface CurrencyLite { id: string; code: string; symbol: string; rateToBase: number; isBase: boolean; }
interface PotBalance { amount: number; currency: CurrencyLite; }
interface FundingPot { id: string; name: string; type: string; balances: PotBalance[]; }
interface FundingContext { monthlyIncomeAvailable: number; currencies: CurrencyLite[]; pots: FundingPot[]; }

// Loans record their principal directly as an income/expense transaction -
// no pot involved. Repaying a borrowed (RECEIVED) loan can still draw from a
// pot, same as any other expense; getting repaid on a lent (GIVEN) loan is
// plain income. Loans only ever move money in the household's base currency
// (out of scope for per-loan currency selection - only pots/income support multiple).
function baseBalance(pot: { balances: PotBalance[] }): number {
  return pot.balances.find((b) => b.currency.isBase)?.amount ?? 0;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export function LoansClient({ loans, summary, fundingContext, openPeriod }: { loans: Loan[]; summary: Summary; fundingContext: FundingContext; openPeriod: { month: number; year: number } }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [periodOverride, setPeriodOverride] = useState<PeriodOverride>({ enabled: false, month: openPeriod.month, year: openPeriod.year });
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [deleteLoanData, setDeleteLoanData] = useState<{ id: string; personName: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ personName: "", description: "", type: "GIVEN", principalAmount: "", date: format(new Date(), "yyyy-MM-dd"), dueDate: "", notes: "" });
  const [payForm, setPayForm] = useState({ amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "", fundingSource: "INCOME", fundingPotId: "" });
  const [useSplit, setUseSplit] = useState(false);
  const [splitRows, setSplitRows] = useState([{ value: "INCOME", pkrAmount: "" }, { value: "INCOME", pkrAmount: "" }]);
  const baseSymbol = fundingContext.currencies.find((c) => c.isBase)?.symbol ?? "Rs";
  const baseCurrencyId = fundingContext.currencies.find((c) => c.isBase)?.id;
  const loanFundingOptions: FundingOption[] = [
    { value: "INCOME", label: `Monthly income · ${baseSymbol} ${(fundingContext.monthlyIncomeAvailable / 100).toLocaleString()} available` },
    ...fundingContext.pots.filter((p) => baseBalance(p) > 0).map((pot) => ({
      value: pot.id,
      label: `${pot.name} (${pot.type}) · ${baseSymbol} ${(baseBalance(pot) / 100).toLocaleString()}`,
    })),
  ];

  const activeLoans = loans.filter((l) => l.status !== "PAID");
  const paidLoans = loans.filter((l) => l.status === "PAID");

  async function handleCreate() {
    if (!form.personName || !form.principalAmount) return;
    setLoading(true);
    const result = await createLoan({
      ...form,
      principalAmount: parseFloat(form.principalAmount),
    });
    if (result.success) {
      toast.success(form.type === "GIVEN" ? "Loan added - recorded as an expense" : "Loan added - recorded as income");
      setCreateOpen(false);
      setForm({ personName: "", description: "", type: "GIVEN", principalAmount: "", date: format(new Date(), "yyyy-MM-dd"), dueDate: "", notes: "" });
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  const payLoan = loans.find((l) => l.id === payOpen);

  async function handlePayment() {
    if (!payOpen || !payForm.amount) return;
    setLoading(true);
    const isReceived = payLoan?.type === "RECEIVED";

    let splitSources: { source: "INCOME" | "SAVINGS_POT"; potId?: string; currencyId?: string; pkrAmount: number }[] | undefined;
    if (isReceived && useSplit) {
      const totalPaisas = Math.round(parseFloat(payForm.amount) * 100);
      const primaryTotal = splitRows.slice(0, -1).reduce((s, r) => s + (Math.round(parseFloat(r.pkrAmount || "0") * 100) || 0), 0);
      const lastAmount = totalPaisas - primaryTotal;
      if (lastAmount <= 0) {
        toast.error("Split sources exceed payment amount");
        setLoading(false);
        return;
      }
      splitSources = splitRows.map((row, idx) => {
        const isLast = idx === splitRows.length - 1;
        const pkrAmount = isLast ? lastAmount : (Math.round(parseFloat(row.pkrAmount || "0") * 100) || 0);
        if (row.value === "INCOME") return { source: "INCOME" as const, pkrAmount };
        return { source: "SAVINGS_POT" as const, potId: row.value, currencyId: baseCurrencyId, pkrAmount };
      });
    }

    const result = await recordPayment(payOpen, {
      amount: parseFloat(payForm.amount),
      date: payForm.date,
      notes: payForm.notes || undefined,
      ...(isReceived && !useSplit ? {
        fundingSource: payForm.fundingSource,
        fundingPotId: payForm.fundingSource === "SAVINGS_POT" ? payForm.fundingPotId : undefined,
      } : {}),
      splitSources: isReceived && useSplit ? splitSources : undefined,
      ...(periodOverride.enabled ? { budgetMonth: periodOverride.month, budgetYear: periodOverride.year } : {}),
    });
    if (result.success) {
      toast.success(isReceived ? "Payment recorded & expense created!" : "Payment recorded & added to income!");
      setPayOpen(null);
      setPayForm({ amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "", fundingSource: "INCOME", fundingPotId: "" });
      setUseSplit(false);
      setSplitRows([{ value: "INCOME", pkrAmount: "" }, { value: "INCOME", pkrAmount: "" }]);
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleMarkPaid(loan: Loan) {
    setPayForm((p) => ({ ...p, amount: String(loan.remainingAmount / 100), fundingSource: "INCOME", fundingPotId: "" }));
    setUseSplit(false);
    setSplitRows([{ value: "INCOME", pkrAmount: "" }, { value: "INCOME", pkrAmount: "" }]);
    setPayOpen(loan.id);
  }

  async function handleDelete() {
    if (!deleteLoanData) return;
    const result = await deleteLoan(deleteLoanData.id);
    if (result.success) toast.success("Loan deleted");
    else toast.error(result.error ?? "Failed to delete");
    setDeleteLoanData(null);
  }

  function LoanCard({ loan }: { loan: Loan }) {
    const paidAmount = loan.principalAmount - loan.remainingAmount;
    const pct = Math.round((paidAmount / loan.principalAmount) * 100);
    const isGiven = loan.type === "GIVEN";
    const isExpanded = expanded === loan.id;

    return (
      <div className={cn("bg-card border rounded-xl overflow-hidden", isGiven ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-900")}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", isGiven ? "bg-emerald-100" : "bg-red-100")}>
              {isGiven ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">{loan.personName}</span>
                <Badge className={cn("text-xs", STATUS_BADGE[loan.status])}>{loan.status.replace("_", " ")}</Badge>
                <Badge variant="outline" className={cn("text-xs", isGiven ? "text-emerald-600" : "text-red-600")}>
                  {isGiven ? "I lent" : "I borrowed"}
                </Badge>
              </div>
              {loan.description && <p className="text-xs text-muted-foreground mt-0.5">{loan.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Remaining </span>
                  <span className={cn("font-bold", isGiven ? "text-emerald-600" : "text-red-600")}>
                    {baseSymbol} {(loan.remainingAmount / 100).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">of </span>
                  <span className="text-muted-foreground">{baseSymbol} {(loan.principalAmount / 100).toLocaleString()}</span>
                </div>
                {loan.dueDate && (
                  <div className="text-xs text-muted-foreground">Due: {format(new Date(loan.dueDate), "d MMM yyyy")}</div>
                )}
              </div>
              {loan.status !== "PAID" && (
                <div className="mt-2">
                  <Progress value={pct} className="h-1.5" />
                  <span className="text-xs text-muted-foreground">{pct}% paid back</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              {loan.status !== "PAID" && (
                <>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setPayOpen(loan.id)}>
                    Record Payment
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-emerald-600" onClick={() => handleMarkPaid(loan)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Mark Paid
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => setExpanded(isExpanded ? null : loan.id)}>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                History
              </Button>
              <button
                onClick={() => setDeleteLoanData({ id: loan.id, personName: loan.personName })}
                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                title="Delete loan"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment History</span>
            </div>
            {loan.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments recorded yet</p>
            ) : (
              <div className="space-y-1.5">
                {loan.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">{format(new Date(p.date), "d MMM yyyy")}</span>
                      {p.notes && <span className="text-muted-foreground text-xs ml-2">· {p.notes}</span>}
                    </div>
                    <span className="font-medium text-emerald-600">+{baseSymbol} {(p.amount / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-border flex justify-between text-xs text-muted-foreground">
              <span>Started: {format(new Date(loan.date), "d MMM yyyy")}</span>
              {loan.notes && <span>{loan.notes}</span>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        section="Savings & Wealth"
        title="Loans"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Loan
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border mb-6">
        <div className="bg-background px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">Owed to me</p>
          <p className="text-xl font-bold text-emerald-500 tabnum">{baseSymbol} {(summary.totalGiven / 100).toLocaleString()}</p>
        </div>
        <div className="bg-background px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">I owe</p>
          <p className="text-xl font-bold text-red-500 tabnum">{baseSymbol} {(summary.totalReceived / 100).toLocaleString()}</p>
        </div>
        <div className="bg-background px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">Net</p>
          <p className={cn("text-xl font-bold tabnum", summary.netPosition >= 0 ? "text-foreground" : "text-red-500")}>
            {summary.netPosition >= 0 ? "+" : ""}{baseSymbol} {(Math.abs(summary.netPosition) / 100).toLocaleString()}
          </p>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeLoans.length})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({paidLoans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {activeLoans.length === 0 ? (
            <EmptyState icon={AlertCircle} title="No active loans" description="Add a loan to start tracking money you've lent or borrowed." action={{ label: "Add Loan", onClick: () => setCreateOpen(true) }} />
          ) : (
            activeLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
          )}
        </TabsContent>

        <TabsContent value="paid" className="mt-4 space-y-3">
          {paidLoans.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No paid loans" description="Fully paid loans will appear here." />
          ) : (
            paidLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Create loan dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select onValueChange={(v) => setForm((p) => ({ ...p, type: v }))} defaultValue="GIVEN">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GIVEN">I lent money to someone</SelectItem>
                  <SelectItem value="RECEIVED">I borrowed money from someone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Person Name</Label>
              <Input value={form.personName} onChange={(e) => setForm((p) => ({ ...p, personName: e.target.value }))} placeholder="e.g. Ahmed, Uncle Tariq" />
            </div>
            <div>
              <Label>Amount ({baseSymbol})</Label>
              <Input type="number" value={form.principalAmount} onChange={(e) => setForm((p) => ({ ...p, principalAmount: e.target.value }))} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>Due Date (optional)</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What was it for?" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any extra details..." />
            </div>
            <p className="text-xs text-muted-foreground">
              {form.type === "GIVEN"
                ? "Recorded as an expense - the money leaves your available cash."
                : "Recorded as income - the money becomes available to budget."}
            </p>
            <Button className="w-full" onClick={handleCreate} disabled={loading}>
              {loading ? "Adding..." : "Add Loan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payOpen} onOpenChange={(o) => { if (!o) { setPayOpen(null); setUseSplit(false); setSplitRows([{ value: "INCOME", pkrAmount: "" }, { value: "INCOME", pkrAmount: "" }]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {payLoan?.type === "RECEIVED" ? "Record Repayment" : "Record Payment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount ({baseSymbol})</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" autoFocus />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={payForm.date} onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            {payLoan?.type === "RECEIVED" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pay from</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSplit(!useSplit);
                      if (!useSplit) setSplitRows([{ value: "INCOME", pkrAmount: "" }, { value: "INCOME", pkrAmount: "" }]);
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {useSplit ? "Single source" : "Split sources"}
                  </button>
                </div>

                {!useSplit ? (
                  <>
                    <Select
                      value={payForm.fundingSource === "SAVINGS_POT" ? payForm.fundingPotId : "INCOME"}
                      onValueChange={(v) => {
                        if (v === "INCOME") setPayForm((p) => ({ ...p, fundingSource: "INCOME", fundingPotId: "" }));
                        else setPayForm((p) => ({ ...p, fundingSource: "SAVINGS_POT", fundingPotId: v }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCOME">
                          Monthly income · {baseSymbol} {(fundingContext.monthlyIncomeAvailable / 100).toLocaleString()} available
                        </SelectItem>
                        {fundingContext.pots.filter((p) => baseBalance(p) > 0).map((pot) => (
                          <SelectItem key={pot.id} value={pot.id}>
                            {pot.name} ({pot.type}) · {baseSymbol} {(baseBalance(pot) / 100).toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Choosing a savings pot deducts the amount immediately.</p>
                  </>
                ) : (
                  <SplitFunding
                    totalAmount={parseFloat(payForm.amount) || 0}
                    options={loanFundingOptions}
                    value={splitRows}
                    onChange={setSplitRows}
                  />
                )}
              </div>
            )}
            {payLoan?.type === "GIVEN" && (
              <p className="text-xs text-muted-foreground">Recorded as income - available to budget once received.</p>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g. Cash, bank transfer" />
            </div>
            <BudgetPeriodOverride openPeriod={openPeriod} value={periodOverride} onChange={setPeriodOverride} />
            <Button className="w-full" onClick={handlePayment} disabled={loading}>
              {loading ? "Recording..." : payLoan?.type === "RECEIVED" ? "Record Repayment" : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteLoanData}
        onOpenChange={(o) => !o && setDeleteLoanData(null)}
        title="Delete loan?"
        description="This removes the loan and its linked transaction from your ledger, plus all payment history. This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
