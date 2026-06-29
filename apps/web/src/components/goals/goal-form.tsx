"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createGoal, updateGoal } from "@/actions/goals";

interface GoalFormValues {
  name: string;
  description: string;
  targetAmount: string;
  deadline: string;
  priority: string;
  color: string;
}

interface Props {
  goal?: { id: string; name: string; description?: string | null; targetAmount: number; priority: string; color: string; goalType?: string };
  onSuccess: () => void;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#3b82f6", "#14b8a6"];

export function GoalForm({ goal, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(goal?.color ?? "#6366f1");
  const [goalType, setGoalType] = useState(goal?.goalType ?? "FIXED");

  const { register, handleSubmit, setValue } = useForm<GoalFormValues>({
    defaultValues: {
      name: goal?.name ?? "",
      description: goal?.description ?? "",
      targetAmount: goal ? String(goal.targetAmount / 100) : "",
      deadline: "",
      priority: goal?.priority ?? "MEDIUM",
      color: goal?.color ?? "#6366f1",
    },
  });

  async function onSubmit(data: GoalFormValues) {
    setLoading(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        icon: "Target",
        color: selectedColor,
        goalType,
        targetAmount: goalType === "ITEMS" ? 0 : parseFloat(data.targetAmount) || 0,
        deadline: data.deadline || undefined,
        priority: data.priority,
      };

      const result = goal
        ? await updateGoal(goal.id, payload)
        : await createGoal(payload);

      if (result.success) {
        toast.success(goal ? "Goal updated!" : "Goal created!");
        onSuccess();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Goal type — first since it changes form structure */}
      {!goal && (
        <div className="space-y-1">
          <Label>Goal Type</Label>
          <Select onValueChange={setGoalType} defaultValue="FIXED">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED">Fixed Amount — enter a target amount upfront</SelectItem>
              <SelectItem value="ITEMS">Milestone List — build a list of items, total auto-calculated</SelectItem>
            </SelectContent>
          </Select>
          {goalType === "ITEMS" && (
            <p className="text-xs text-muted-foreground px-1">
              Add items with costs after creating — the target amount updates automatically.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label>Goal Name</Label>
        <Input placeholder="e.g. Gaming PC Build" {...register("name", { required: true })} />
      </div>

      <div className="space-y-1">
        <Label>Description (optional)</Label>
        <Textarea rows={2} placeholder="What are you saving for?" {...register("description")} />
      </div>

      {goalType === "FIXED" && (
        <div className="space-y-1">
          <Label>Target Amount (Rs)</Label>
          <Input type="number" step="0.01" placeholder="0.00" {...register("targetAmount", { required: goalType === "FIXED" })} />
        </div>
      )}

      <div className="space-y-1">
        <Label>Deadline (optional)</Label>
        <Input type="date" {...register("deadline")} />
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>
        <Select onValueChange={(v) => setValue("priority", v)} defaultValue="MEDIUM">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className="w-8 h-8 rounded-full border-2 transition-all"
              style={{
                backgroundColor: color,
                borderColor: selectedColor === color ? "#fff" : "transparent",
                boxShadow: selectedColor === color ? `0 0 0 2px ${color}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : goal ? "Save Changes" : "Create Goal"}
      </Button>
    </form>
  );
}
