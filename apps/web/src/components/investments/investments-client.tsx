"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Plus, LineChart, RefreshCw, Trash2, ChevronDown, ChevronUp, Wallet, MoreHorizontal,
  Landmark, TrendingUp, Gem, Bitcoin, PiggyBank, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  createInvestment, updateInvestment, deleteInvestment,
  addInvestmentContribution, deleteInvestmentContribution,
  type InvestmentSuggestion,
} from "@/actions/savings";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { InvestmentPlanCard } from "@/components/investments/investment-plan-card";

interface Contribution {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
}

interface Investment {
  id: string;
  name: string;
  type: string;
  platform: string;
  investedAmount: number;
  currentValue: number;
  units: number | null;
  purchaseDate: Date;
  lastUpdated: Date;
  notes: string | null;
  customFields?: string | null;
  planCategoryId: string | null;
  contributions: Contribution[];
}

interface PlanCategoryOption {
  id: string;
  name: string;
}

interface CustomFields {
  // Mutual fund
  fundHouse?: string;
  nav?: string;
  folioNumber?: string;
  mfUnits?: string;
  // Stocks
  ticker?: string;
  shares?: string;
  exchange?: string;
  pricePerShare?: string;
  // Gold
  weightGrams?: string;
  purity?: string;
  storageLocation?: string;
  // Fixed deposit
  bank?: string;
  interestRate?: string;
  maturityDate?: string;
}

const TYPES = [
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "STOCKS", label: "Stocks" },
  { value: "GOLD", label: "Gold" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit" },
  { value: "OTHER", label: "Other" },
];

// Monochrome icon per type instead of a colored badge chip — keeps the
// emerald accent meaningful (gain/loss only) instead of diluted across a
// rainbow of pastel tags.
const TYPE_ICON: Record<string, typeof Landmark> = {
  MUTUAL_FUND: Landmark,
  STOCKS: TrendingUp,
  GOLD: Gem,
  CRYPTO: Bitcoin,
  FIXED_DEPOSIT: PiggyBank,
  OTHER: Layers,
};

function parseCustomFields(raw: string | null): CustomFields {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function CustomFieldsForm({ type, fields, onChange, baseSymbol }: {
  type: string;
  fields: CustomFields;
  onChange: (f: CustomFields) => void;
  baseSymbol: string;
}) {
  const set = (key: keyof CustomFields, value: string) => onChange({ ...fields, [key]: value });

  if (type === "MUTUAL_FUND") return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mutual Fund Details</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Fund House</Label><Input placeholder="e.g. Meezan" value={fields.fundHouse ?? ""} onChange={(e) => set("fundHouse", e.target.value)} /></div>
        <div><Label className="text-xs">Folio Number</Label><Input placeholder="Optional" value={fields.folioNumber ?? ""} onChange={(e) => set("folioNumber", e.target.value)} /></div>
        <div><Label className="text-xs">NAV ({baseSymbol})</Label><Input type="number" placeholder="0.00" value={fields.nav ?? ""} onChange={(e) => set("nav", e.target.value)} /></div>
        <div><Label className="text-xs">Units</Label><Input type="number" placeholder="0.00" value={fields.mfUnits ?? ""} onChange={(e) => set("mfUnits", e.target.value)} /></div>
      </div>
    </div>
  );

  if (type === "STOCKS") return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Details</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Ticker</Label><Input placeholder="e.g. LUCK" value={fields.ticker ?? ""} onChange={(e) => set("ticker", e.target.value)} /></div>
        <div><Label className="text-xs">Exchange</Label><Input placeholder="e.g. PSX" value={fields.exchange ?? ""} onChange={(e) => set("exchange", e.target.value)} /></div>
        <div><Label className="text-xs">Shares</Label><Input type="number" placeholder="0" value={fields.shares ?? ""} onChange={(e) => set("shares", e.target.value)} /></div>
        <div><Label className="text-xs">Price/Share ({baseSymbol})</Label><Input type="number" placeholder="0.00" value={fields.pricePerShare ?? ""} onChange={(e) => set("pricePerShare", e.target.value)} /></div>
      </div>
    </div>
  );

  if (type === "GOLD") return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gold Details</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Weight (grams)</Label><Input type="number" placeholder="0.00" value={fields.weightGrams ?? ""} onChange={(e) => set("weightGrams", e.target.value)} /></div>
        <div><Label className="text-xs">Purity</Label>
          <Select value={fields.purity ?? "24K"} onValueChange={(v) => set("purity", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["24K", "22K", "21K", "18K"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label className="text-xs">Storage Location</Label><Input placeholder="e.g. Bank locker, Home" value={fields.storageLocation ?? ""} onChange={(e) => set("storageLocation", e.target.value)} /></div>
      </div>
    </div>
  );

  if (type === "FIXED_DEPOSIT") return (
    <div className="space-y-3 border border-border rounded-lg p-3 bg-muted/30">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fixed Deposit Details</div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Bank</Label><Input placeholder="e.g. HBL" value={fields.bank ?? ""} onChange={(e) => set("bank", e.target.value)} /></div>
        <div><Label className="text-xs">Interest Rate (%)</Label><Input type="number" placeholder="0.00" value={fields.interestRate ?? ""} onChange={(e) => set("interestRate", e.target.value)} /></div>
        <div className="col-span-2"><Label className="text-xs">Maturity Date</Label><Input type="date" value={fields.maturityDate ?? ""} onChange={(e) => set("maturityDate", e.target.value)} /></div>
      </div>
    </div>
  );

  return null;
}

function CustomFieldsSummary({ type, raw, baseSymbol }: { type: string; raw: string | null; baseSymbol: string }) {
  const f = parseCustomFields(raw);
  if (type === "MUTUAL_FUND") return (
    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
      {f.fundHouse && <span>Fund: {f.fundHouse}</span>}
      {f.nav && <span>NAV: {baseSymbol} {f.nav}</span>}
      {f.mfUnits && <span>Units: {f.mfUnits}</span>}
      {f.folioNumber && <span>Folio: {f.folioNumber}</span>}
    </div>
  );
  if (type === "STOCKS") return (
    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
      {f.ticker && <span className="font-mono">{f.ticker}</span>}
      {f.exchange && <span>{f.exchange}</span>}
      {f.shares && <span>{f.shares} shares</span>}
      {f.pricePerShare && <span>@{baseSymbol} {f.pricePerShare}</span>}
    </div>
  );
  if (type === "GOLD") return (
    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
      {f.weightGrams && <span>{f.weightGrams}g</span>}
      {f.purity && <span>{f.purity}</span>}
      {f.storageLocation && <span>{f.storageLocation}</span>}
    </div>
  );
  if (type === "FIXED_DEPOSIT") return (
    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
      {f.bank && <span>{f.bank}</span>}
      {f.interestRate && <span>{f.interestRate}% p.a.</span>}
      {f.maturityDate && <span>Matures {format(new Date(f.maturityDate), "dd MMM yyyy")}</span>}
    </div>
  );
  return null;
}

const BLANK_FORM = {
  name: "", type: "MUTUAL_FUND", platform: "", investedAmount: "", currentValue: "",
  purchaseDate: format(new Date(), "yyyy-MM-dd"), notes: "", planCategoryId: "",
};

const BLANK_CONTRIBUTION = { amount: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" };

export function InvestmentsClient({
  investments,
  baseSymbol = "Rs",
  plan,
  suggestion,
}: {
  investments: Investment[];
  baseSymbol?: string;
  plan: { monthlyTarget: number; autoFromSurplus: boolean; categories: { id: string; name: string; investmentType: string | null; percentage: number }[] } | null;
  suggestion: InvestmentSuggestion;
}) {
  const planCategories: PlanCategoryOption[] = plan?.categories.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const categoryName = (id: string | null) => planCategories.find((c) => c.id === id)?.name ?? null;

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Investment | null>(null);
  const [contributeItem, setContributeItem] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [customFields, setCustomFields] = useState<CustomFields>({});
  const [editFields, setEditFields] = useState<CustomFields>({});
  const [editForm, setEditForm] = useState({ currentValue: "", units: "", notes: "" });
  const [contributionForm, setContributionForm] = useState(BLANK_CONTRIBUTION);

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrentValue = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalGain = totalCurrentValue - totalInvested;

  async function handleAdd() {
    if (!form.name || !form.investedAmount) return;
    setLoading(true);
    const result = await createInvestment({
      name: form.name,
      type: form.type,
      platform: form.platform,
      investedAmount: parseFloat(form.investedAmount),
      currentValue: form.currentValue ? parseFloat(form.currentValue) : undefined,
      purchaseDate: form.purchaseDate,
      notes: form.notes || undefined,
      customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : undefined,
      planCategoryId: form.planCategoryId || null,
    });
    if (result.success) {
      toast.success("SIP created!");
      setAddOpen(false);
      setForm(BLANK_FORM);
      setCustomFields({});
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleUpdate() {
    if (!editItem) return;
    setLoading(true);
    const result = await updateInvestment(editItem.id, {
      currentValue: parseFloat(editForm.currentValue) || editItem.currentValue / 100,
      units: editForm.units ? parseFloat(editForm.units) : undefined,
      customFields: Object.keys(editFields).length > 0 ? JSON.stringify(editFields) : undefined,
      notes: editForm.notes || undefined,
    });
    if (result.success) {
      toast.success("Updated!");
      setEditItem(null);
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleContribute() {
    if (!contributeItem || !contributionForm.amount) return;
    setLoading(true);
    const result = await addInvestmentContribution(contributeItem.id, {
      amount: parseFloat(contributionForm.amount),
      date: contributionForm.date,
      notes: contributionForm.notes || undefined,
    });
    if (result.success) {
      toast.success("Contribution logged!");
      setContributeItem(null);
      setContributionForm(BLANK_CONTRIBUTION);
    } else toast.error(result.error ?? "Failed");
    setLoading(false);
  }

  async function handleDeleteContribution(id: string) {
    const result = await deleteInvestmentContribution(id);
    if (!result.success) toast.error(result.error ?? "Failed");
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteInvestment(deleteId);
    if (result.success) toast.success("Deleted");
    else toast.error(result.error ?? "Failed");
    setDeleteId(null);
  }

  function openEdit(inv: Investment) {
    setEditItem(inv);
    setEditFields(parseCustomFields(inv.customFields ?? null));
    setEditForm({
      currentValue: String(inv.currentValue / 100),
      units: inv.units ? String(inv.units) : "",
      notes: inv.notes ?? "",
    });
  }

  return (
    <>
      <PageHeader
        section="Savings & Wealth"
        title="Investments"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            New SIP
          </Button>
        }
      />

      <div className="space-y-6">
      {/* Plan card = target split (what you intend to invest). SIP list below = actual contributions. */}
      <InvestmentPlanCard plan={plan} suggestion={suggestion} baseSymbol={baseSymbol} />

      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Invested Savings</h3>
          </div>
          {investments.length > 0 && (
            <div className="text-right">
              <span className="text-xl font-bold text-foreground tabnum">{baseSymbol} {(totalCurrentValue / 100).toLocaleString()}</span>
              <span className={cn("ml-2 text-xs font-medium tabnum", totalGain >= 0 ? "text-emerald-500" : "text-red-500")}>
                {totalGain >= 0 ? "+" : ""}{baseSymbol} {(Math.abs(totalGain) / 100).toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {investments.length > 0 && (
          <p className="text-xs text-muted-foreground -mt-2">
            {baseSymbol} {(totalInvested / 100).toLocaleString()} invested across {investments.length} SIP{investments.length !== 1 ? "s" : ""}
          </p>
        )}

        {investments.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="No SIPs yet"
            description="Set up a recurring investment vehicle (e.g. an ETF or mutual fund) and log a contribution to it any time, any amount."
            action={{ label: "New SIP", onClick: () => setAddOpen(true) }}
          />
        ) : (
          <div className="divide-y divide-border -mx-5">
            {investments.map((inv) => {
              const gain = inv.currentValue - inv.investedAmount;
              const gainPct = inv.investedAmount > 0 ? ((gain / inv.investedAmount) * 100).toFixed(1) : "0.0";
              const linkedCategory = categoryName(inv.planCategoryId);
              const isExpanded = !!expanded[inv.id];
              const TypeIcon = TYPE_ICON[inv.type] ?? Layers;
              const typeLabel = TYPES.find((t) => t.value === inv.type)?.label ?? inv.type;
              const hasCustomFields = Object.keys(parseCustomFields(inv.customFields ?? null)).length > 0;
              return (
                <div key={inv.id} className="px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground leading-tight">{inv.name}</span>
                        {linkedCategory && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">{linkedCategory}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {typeLabel} · {inv.platform} · {baseSymbol} {(inv.investedAmount / 100).toLocaleString()} in · {inv.contributions.length} contribution{inv.contributions.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-foreground tabnum leading-tight">{baseSymbol} {(inv.currentValue / 100).toLocaleString()}</div>
                      <div className={cn("text-xs font-medium tabnum mt-0.5", gain >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {gain >= 0 ? "+" : ""}{baseSymbol} {(gain / 100).toLocaleString()} · {gain >= 0 ? "+" : ""}{gainPct}%
                      </div>
                    </div>
                  </div>

                  {(inv.notes || hasCustomFields) && (
                    <div className="mt-2 pl-[3.125rem] space-y-1">
                      <CustomFieldsSummary type={inv.type} raw={inv.customFields ?? null} baseSymbol={baseSymbol} />
                      {inv.notes && <div className="text-xs text-muted-foreground italic">{inv.notes}</div>}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-3 pl-[3.125rem]">
                    <Button size="sm" onClick={() => { setContributeItem(inv); setContributionForm(BLANK_CONTRIBUTION); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Log contribution
                    </Button>
                    {inv.contributions.length > 0 && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setExpanded((e) => ({ ...e, [inv.id]: !e[inv.id] }))}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                        History
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Update value
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete SIP
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 ml-[3.125rem] border-l border-border">
                      {inv.contributions.map((c) => (
                        <div key={c.id} className="group/entry relative flex items-center justify-between gap-2 pl-4 py-1.5 text-xs">
                          <span className="absolute -left-[3.5px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/40" />
                          <div className="min-w-0 flex items-baseline gap-2">
                            <span className="tabnum font-medium text-foreground">{baseSymbol} {(c.amount / 100).toLocaleString()}</span>
                            {c.notes && <span className="text-muted-foreground truncate">{c.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground tabnum">{format(c.date, "dd MMM yyyy")}</span>
                            <button
                              onClick={() => handleDeleteContribution(c.id)}
                              className="text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/entry:opacity-100"
                              aria-label="Delete contribution"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* New SIP dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setForm(BLANK_FORM); setCustomFields({}); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New SIP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. MZNPETF" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => { setForm((f) => ({ ...f, type: v })); setCustomFields({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Platform / Broker</Label>
                <Input placeholder="e.g. KTrade" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} />
              </div>
            </div>
            {planCategories.length > 0 && (
              <div className="space-y-1.5">
                <Label>Counts toward plan category <span className="text-muted-foreground">(optional)</span></Label>
                <Select value={form.planCategoryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, planCategoryId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {planCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Links this SIP&apos;s contributions to the target split above, so planned-vs-actual tracks correctly.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Contribution ({baseSymbol})</Label>
                <Input type="number" placeholder="0" value={form.investedAmount} onChange={(e) => setForm((f) => ({ ...f, investedAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Value ({baseSymbol})</Label>
                <Input type="number" placeholder="Same as invested" value={form.currentValue} onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <CustomFieldsForm type={form.type} fields={customFields} onChange={setCustomFields} baseSymbol={baseSymbol} />
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea placeholder="Any notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button onClick={handleAdd} disabled={loading || !form.name || !form.investedAmount} className="w-full">
              Create SIP
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log contribution dialog */}
      <Dialog open={!!contributeItem} onOpenChange={(o) => { if (!o) { setContributeItem(null); setContributionForm(BLANK_CONTRIBUTION); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log contribution — {contributeItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount ({baseSymbol})</Label>
              <Input type="number" placeholder="0" value={contributionForm.amount} onChange={(e) => setContributionForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={contributionForm.date} onChange={(e) => setContributionForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea rows={2} value={contributionForm.notes} onChange={(e) => setContributionForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button onClick={handleContribute} disabled={loading || !contributionForm.amount} className="w-full">
              Log contribution
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update value dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update value — {editItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current Value ({baseSymbol})</Label>
                <Input type="number" value={editForm.currentValue} onChange={(e) => setEditForm((f) => ({ ...f, currentValue: e.target.value }))} />
              </div>
              {(editItem?.type === "MUTUAL_FUND" || editItem?.type === "STOCKS") && (
                <div className="space-y-1.5">
                  <Label>Units / Shares</Label>
                  <Input type="number" value={editForm.units} onChange={(e) => setEditForm((f) => ({ ...f, units: e.target.value }))} />
                </div>
              )}
            </div>
            {editItem && <CustomFieldsForm type={editItem.type} fields={editFields} onChange={setEditFields} baseSymbol={baseSymbol} />}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button onClick={handleUpdate} disabled={loading} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete SIP?"
        description="This will permanently remove the SIP and its full contribution history."
        onConfirm={handleDelete}
      />
    </>
  );
}
