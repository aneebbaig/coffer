"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, ArrowLeft, CheckCircle2, AlertTriangle, TrendingUp, Info, GripVertical, Loader2, Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { addMoneyToGoal, updateGoalItems, deleteGoal, updateGoal, logGoalItemExpense } from "@/actions/goals";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { GoalForm } from "@/components/goals/goal-form";
import { GoalItem } from "@/types";
import { getDaysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  priority: string;
  status: string;
  items: string;
  goalType: string;
}

interface FinancialPosition {
  accumulatedSavings: number;
  savingsPotsTotal: number;
  investmentsTotal: number;
  loansOwed: number;
  loansReceivable: number;
  liquidAvailable: number;
  netWorth: number;
}

function SortableItem({
  item, onToggle, onRemove, onRename, onUpdateCost, onLogExpense, baseSymbol,
}: {
  item: GoalItem;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onUpdateCost: (cost: number) => void;
  onLogExpense: () => Promise<void>;
  baseSymbol: string;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(item.name);
  const [editingCost, setEditingCost] = useState(false);
  const [costValue, setCostValue] = useState(item.estimatedCost > 0 ? (item.estimatedCost / 100).toString() : "");
  const [loggingExpense, setLoggingExpense] = useState(false);

  const cost = item.actualCost ?? item.estimatedCost;
  const showLogExpense = item.purchased && !item.expenseLogged && cost > 0;

  async function handleLogExpense() {
    setLoggingExpense(true);
    await onLogExpense();
    setLoggingExpense(false);
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== item.name) onRename(trimmed);
    else setNameValue(item.name);
    setEditingName(false);
  }

  function commitCost() {
    const parsed = parseFloat(costValue);
    onUpdateCost(isNaN(parsed) || parsed < 0 ? 0 : parsed);
    setEditingCost(false);
  }

  return (
    <div ref={setNodeRef} style={style} className="py-2 border-b border-border last:border-0 group/item">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 p-1 -ml-1"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            item.purchased ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"
          )}
        >
          {item.purchased && <Check className="h-3 w-3 text-white" />}
        </button>

        {/* Name - click to edit inline */}
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitName(); }
              if (e.key === "Escape") { setNameValue(item.name); setEditingName(false); }
            }}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none py-0.5"
          />
        ) : (
          <span
            onClick={() => { setNameValue(item.name); setEditingName(true); }}
            className={cn(
              "flex-1 text-sm cursor-pointer select-none",
              item.purchased && "line-through text-muted-foreground"
            )}
            title="Click to rename"
          >
            {item.name}
          </span>
        )}

        {/* Cost - click to edit inline */}
        {editingCost ? (
          <input
            autoFocus
            type="number"
            value={costValue}
            onChange={(e) => setCostValue(e.target.value)}
            onBlur={commitCost}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitCost(); }
              if (e.key === "Escape") { setCostValue(item.estimatedCost > 0 ? (item.estimatedCost / 100).toString() : ""); setEditingCost(false); }
            }}
            className="w-24 text-sm bg-transparent border-b border-primary outline-none py-0.5 text-right"
            placeholder="0"
          />
        ) : (
          <span
            onClick={() => { setCostValue(item.estimatedCost > 0 ? (item.estimatedCost / 100).toString() : ""); setEditingCost(true); }}
            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors shrink-0"
            title="Click to edit cost"
          >
            {item.estimatedCost > 0 ? `${baseSymbol} ${(item.estimatedCost / 100).toLocaleString()}` : <span className="opacity-0 group-hover/item:opacity-100 transition-opacity"><Pencil className="h-3 w-3 inline" /> cost</span>}
          </span>
        )}

        <button onClick={onRemove} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showLogExpense && (
        <div className="flex items-center justify-end mt-1.5 pl-6">
          <button
            onClick={handleLogExpense}
            disabled={loggingExpense}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md px-2 py-1 transition-colors disabled:opacity-60"
          >
            {loggingExpense ? <Loader2 className="h-3 w-3 animate-spin" /> : <Receipt className="h-3 w-3" />}
            Log {baseSymbol} {(cost / 100).toLocaleString()} expense
          </button>
        </div>
      )}
      {item.expenseLogged && (
        <div className="flex items-center justify-end mt-1 pl-6">
          <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />Expense logged
          </span>
        </div>
      )}
    </div>
  );
}

export function GoalDetailClient({ goal, financialPosition, baseSymbol = "Rs" }: { goal: Goal; financialPosition: FinancialPosition; baseSymbol?: string }) {
  const router = useRouter();
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addingMoney, setAddingMoney] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [items, setItems] = useState<GoalItem[]>(() => {
    try { return JSON.parse(goal.items); } catch { return []; }
  });
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const isItemsGoal = goal.goalType === "ITEMS";
  const itemsTotal = items.reduce((sum, i) => sum + i.estimatedCost, 0);
  const purchasedTotal = items.filter((i) => i.purchased).reduce((sum, i) => sum + i.estimatedCost, 0);
  const pct = isItemsGoal
    ? (itemsTotal > 0 ? Math.min(Math.round((purchasedTotal / itemsTotal) * 100), 100) : 0)
    : (goal.targetAmount > 0 ? Math.min(Math.round((goal.savedAmount / goal.targetAmount) * 100), 100) : 0);
  const daysLeft = getDaysUntil(goal.deadline);

  // Affordability calculation - use items total if available, else targetAmount
  const goalCost = itemsTotal > 0 ? itemsTotal : goal.targetAmount;
  const coveragePct = goalCost > 0 ? Math.round((financialPosition.liquidAvailable / goalCost) * 100) : 100;
  const shortfall = goalCost - financialPosition.liquidAvailable;
  const canFullyAfford = financialPosition.liquidAvailable >= goalCost;

  async function handleAddMoney() {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) return;
    setAddingMoney(true);
    const result = await addMoneyToGoal(goal.id, amount);
    setAddingMoney(false);
    if (result.success) {
      toast.success(`${baseSymbol} ${amount.toLocaleString()} added to goal!`);
      setAddMoneyOpen(false);
      setAddAmount("");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed");
    }
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return;
    const newItem: GoalItem = {
      id: crypto.randomUUID(),
      name: newItemName,
      estimatedCost: parseFloat(newItemCost) * 100 || 0,
      purchased: false,
    };
    const updated = [...items, newItem];
    setItems(updated);
    await updateGoalItems(goal.id, updated);
    setNewItemName("");
    setNewItemCost("");
    toast.success("Item added");
  }

  async function togglePurchased(itemId: string) {
    const updated = items.map((i) => i.id === itemId ? { ...i, purchased: !i.purchased } : i);
    setItems(updated);
    await updateGoalItems(goal.id, updated);
  }

  async function logItemExpense(itemId: string) {
    const result = await logGoalItemExpense(goal.id, itemId);
    if (result.success) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, expenseLogged: true } : i)));
      toast.success("Expense logged");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to log expense");
    }
  }

  async function removeItem(itemId: string) {
    const updated = items.filter((i) => i.id !== itemId);
    setItems(updated);
    await updateGoalItems(goal.id, updated);
    toast.success("Item removed");
  }

  async function renameItem(itemId: string, newName: string) {
    const updated = items.map((i) => i.id === itemId ? { ...i, name: newName } : i);
    setItems(updated);
    await updateGoalItems(goal.id, updated);
  }

  async function updateItemCost(itemId: string, newCost: number) {
    const updated = items.map((i) => i.id === itemId ? { ...i, estimatedCost: Math.round(newCost * 100) } : i);
    setItems(updated);
    await updateGoalItems(goal.id, updated);
  }

  async function handleDelete() {
    setDeletingGoal(true);
    const result = await deleteGoal(goal.id);
    if (result.success) {
      toast.success("Goal deleted");
      router.push("/goals");
    } else {
      toast.error("Failed to delete");
      setDeletingGoal(false);
    }
  }

  async function handleStatusChange(status: string) {
    await updateGoal(goal.id, { status });
    toast.success(`Goal ${status.toLowerCase()}`);
    router.refresh();
  }

  async function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    await updateGoalItems(goal.id, reordered);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/goals">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{goal.name}</h1>
          {goal.description && <p className="text-sm text-muted-foreground mt-0.5">{goal.description}</p>}
        </div>
        <Badge style={{ backgroundColor: goal.color }} className="text-white">{goal.status}</Badge>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
              <circle
                cx="40" cy="40" r="36" fill="none" strokeWidth="7"
                stroke={goal.color}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={(2 * Math.PI * 36) * (1 - pct / 100)}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{pct}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              {isItemsGoal ? (
                <>
                  <div className="text-3xl font-bold" style={{ color: goal.color }}>
                    {items.filter((i) => i.purchased).length} / {items.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    items purchased · {baseSymbol} {(purchasedTotal / 100).toLocaleString()} of {baseSymbol} {(itemsTotal / 100).toLocaleString()}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold" style={{ color: goal.color }}>{baseSymbol} {(goal.savedAmount / 100).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">of {baseSymbol} {(goal.targetAmount / 100).toLocaleString()} saved</div>
                </>
              )}
            </div>
            {daysLeft !== null && (
              <div className={cn("text-sm font-medium", daysLeft < 0 ? "text-red-500" : daysLeft < 30 ? "text-amber-500" : "text-muted-foreground")}>
                {daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Deadline: Today!" : `${daysLeft} days until deadline`}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {!isItemsGoal && (
                <Button size="sm" onClick={() => setAddMoneyOpen(true)} style={{ backgroundColor: goal.color }}>
                  <Plus className="h-3.5 w-3.5" />Add Money
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              {goal.status === "ACTIVE" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange("PAUSED")}>Pause</Button>
              )}
              {goal.status === "PAUSED" && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange("ACTIVE")}>Resume</Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Affordability Panel */}
      {goalCost > 0 && (
        <div className={cn("rounded-xl border p-5",
          canFullyAfford
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
            : coveragePct >= 50
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
            : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
        )}>
          <div className="flex items-center gap-2 mb-3">
            {canFullyAfford
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : coveragePct >= 50
              ? <AlertTriangle className="h-4 w-4 text-amber-600" />
              : <AlertTriangle className="h-4 w-4 text-red-500" />
            }
            <span className="font-semibold text-foreground text-sm">
              {canFullyAfford ? "You can afford this right now" : `You can cover ${Math.min(coveragePct, 100)}% of this goal`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Available (liquid)</div>
              <div className="text-base font-bold text-foreground">{baseSymbol} {(financialPosition.liquidAvailable / 100).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">savings + pots</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Investments</div>
              <div className="text-base font-bold text-foreground">{baseSymbol} {(financialPosition.investmentsTotal / 100).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">if liquidated</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Goal cost</div>
              <div className="text-base font-bold text-foreground">{baseSymbol} {(goalCost / 100).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{itemsTotal > 0 ? "from items list" : "target amount"}</div>
            </div>
          </div>

          {!canFullyAfford && shortfall > 0 && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border pt-3 mt-1">
              <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Shortfall: {baseSymbol} {(shortfall / 100).toLocaleString()}.
                {financialPosition.investmentsTotal >= shortfall
                  ? " Your investments cover the gap if liquidated."
                  : " Keep saving - add money to this goal each month to reach it."}
              </span>
            </div>
          )}
          {canFullyAfford && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 border-t border-emerald-200 dark:border-emerald-800 pt-3 mt-1">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Your accumulated savings cover this goal entirely. You can start spending toward it now.
            </div>
          )}
        </div>
      )}

      {/* Items checklist */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{isItemsGoal ? "Milestone Items" : "Shopping List"}</h3>
          <div className="flex items-center gap-3">
            {itemsTotal > 0 && (
              <span className="text-sm text-muted-foreground">Total: {baseSymbol} {(itemsTotal / 100).toLocaleString()}</span>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3">Click item name or cost to edit inline</p>
        )}

        {items.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="mb-4">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onToggle={() => togglePurchased(item.id)}
                    onRemove={() => removeItem(item.id)}
                    onRename={(name) => renameItem(item.id, name)}
                    onUpdateCost={(cost) => updateItemCost(item.id, cost)}
                    onLogExpense={() => logItemExpense(item.id)}
                    baseSymbol={baseSymbol}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex gap-2">
          <Input placeholder="Item name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1" />
          <Input placeholder={`${baseSymbol} cost`} type="number" value={newItemCost} onChange={(e) => setNewItemCost(e.target.value)} className="w-28" />
          <Button onClick={handleAddItem} size="icon"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={addMoneyOpen} onOpenChange={setAddMoneyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Money to Goal</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              type="number"
              placeholder={`Amount (${baseSymbol})`}
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className="text-lg"
            />
            <Button onClick={handleAddMoney} className="w-full" style={{ backgroundColor: goal.color }} disabled={addingMoney || !addAmount || parseFloat(addAmount) <= 0}>
              {addingMoney ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${baseSymbol} ${parseFloat(addAmount || "0").toLocaleString()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this goal?"
        description="All progress will be lost. This cannot be undone."
        onConfirm={handleDelete}
        loading={deletingGoal}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
          <GoalForm
            goal={{ id: goal.id, name: goal.name, description: goal.description, targetAmount: goal.targetAmount, priority: goal.priority, color: goal.color, goalType: goal.goalType }}
            onSuccess={() => { setEditOpen(false); router.refresh(); }}
            baseSymbol={baseSymbol}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
