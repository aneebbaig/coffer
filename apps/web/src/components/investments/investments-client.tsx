"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Plus, TrendingUp, TrendingDown, LineChart, RefreshCw, Trash2, Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createInvestment, updateInvestment, deleteInvestment } from "@/actions/savings";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

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

const TYPE_COLOR: Record<string, string> = {
  MUTUAL_FUND: "bg-blue-100 text-blue-700",
  STOCKS: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  GOLD: "bg-amber-100 text-amber-700",
  CRYPTO: "bg-orange-100 text-orange-700",
  FIXED_DEPOSIT: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-gray-100 text-gray-700",
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
  purchaseDate: format(new Date(), "yyyy-MM-dd"), notes: "",
};

export function InvestmentsClient({ investments, baseSymbol = "Rs" }: { investments: Investment[]; baseSymbol?: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [customFields, setCustomFields] = useState<CustomFields>({});
  const [editFields, setEditFields] = useState<CustomFields>({});
  const [editForm, setEditForm] = useState({ currentValue: "", units: "", notes: "" });

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrentValue = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalGain = totalCurrentValue - totalInvested;

  const byType = investments.reduce<Record<string, Investment[]>>((acc, inv) => {
    if (!acc[inv.type]) acc[inv.type] = [];
    acc[inv.type].push(inv);
    return acc;
  }, {});

  async function handleAdd() {
    if (!form.name || !form.investedAmount) return;
    setLoading(true);
    const result = await createInvestment({
      name: form.name,
      type: form.type,
      platform: form.platform,
      investedAmount: parseFloat(form.investedAmount),
      currentValue: parseFloat(form.currentValue) || parseFloat(form.investedAmount),
      purchaseDate: form.purchaseDate,
      notes: form.notes || undefined,
      customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : undefined,
    });
    if (result.success) {
      toast.success("Investment added!");
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
            Add Investment
          </Button>
        }
      />

      {/* Summary strip */}
      {investments.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          <div className="bg-background px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">Invested</p>
            <p className="text-xl font-bold text-foreground tabnum">{baseSymbol} {(totalInvested / 100).toLocaleString()}</p>
          </div>
          <div className="bg-background px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">Current Value</p>
            <p className={cn("text-xl font-bold tabnum", totalGain >= 0 ? "text-emerald-500" : "text-red-500")}>
              {baseSymbol} {(totalCurrentValue / 100).toLocaleString()}
            </p>
          </div>
          <div className="bg-background px-5 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-1.5">
              {totalGain >= 0 ? "Total Gain" : "Total Loss"}
            </p>
            <p className={cn("text-xl font-bold tabnum", totalGain >= 0 ? "text-emerald-500" : "text-red-500")}>
              {totalGain >= 0 ? "+" : ""}{baseSymbol} {(Math.abs(totalGain) / 100).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No investments yet"
          description="Track mutual funds, stocks, gold, fixed deposits, and more."
          action={{ label: "Add Investment", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(byType).map(([type, items]) => {
            const typeLabel = TYPES.find((t) => t.value === type)?.label ?? type;
            const typeTotalInvested = items.reduce((s, i) => s + i.investedAmount, 0);
            const typeTotalCurrent = items.reduce((s, i) => s + i.currentValue, 0);
            const typeGain = typeTotalCurrent - typeTotalInvested;
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", TYPE_COLOR[type] ?? "bg-gray-100 text-gray-700")}>{typeLabel}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.length} holding{items.length !== 1 ? "s" : ""} ·
                    {typeGain >= 0 ? " +" : " "}{baseSymbol} {(Math.abs(typeGain) / 100).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((inv) => {
                    const gain = inv.currentValue - inv.investedAmount;
                    const gainPct = inv.investedAmount > 0 ? ((gain / inv.investedAmount) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={inv.id} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-semibold text-foreground">{inv.name}</div>
                            <div className="text-xs text-muted-foreground">{inv.platform} · {format(inv.purchaseDate, "dd MMM yyyy")}</div>
                            <CustomFieldsSummary type={inv.type} raw={inv.customFields ?? null} baseSymbol={baseSymbol} />
                            {inv.notes && <div className="text-xs text-muted-foreground italic">{inv.notes}</div>}
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <div className="font-bold text-foreground">{baseSymbol} {(inv.currentValue / 100).toLocaleString()}</div>
                            <div className={cn("text-xs font-medium", gain >= 0 ? "text-emerald-600" : "text-red-500")}>
                              {gain >= 0 ? "+" : ""}{baseSymbol} {(gain / 100).toLocaleString()} ({gainPct}%)
                            </div>
                            <div className="text-xs text-muted-foreground">Invested: {baseSymbol} {(inv.investedAmount / 100).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" onClick={() => openEdit(inv)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Update
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => setDeleteId(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setForm(BLANK_FORM); setCustomFields({}); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Investment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Meezan Islamic Fund" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
                <Input placeholder="e.g. Meezan Bank" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount Invested ({baseSymbol})</Label>
                <Input type="number" placeholder="0" value={form.investedAmount} onChange={(e) => setForm((f) => ({ ...f, investedAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Value ({baseSymbol})</Label>
                <Input type="number" placeholder="Same as invested" value={form.currentValue} onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <CustomFieldsForm type={form.type} fields={customFields} onChange={setCustomFields} baseSymbol={baseSymbol} />
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea placeholder="Any notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button onClick={handleAdd} disabled={loading || !form.name || !form.investedAmount} className="w-full">
              Add Investment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update - {editItem?.name}</DialogTitle>
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
        title="Delete investment?"
        description="This will permanently remove the investment record."
        onConfirm={handleDelete}
      />
    </>
  );
}
