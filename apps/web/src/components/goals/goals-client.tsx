"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalForm } from "@/components/goals/goal-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reorderGoals } from "@/actions/goals";
import { PageHeader } from "@/components/shared/page-header";
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
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  targetAmount: number;
  savedAmount: number;
  deadline: Date | null;
  priority: string;
  status: string;
  order: number;
  goalType?: string;
}

function SortableGoalCard({ goal, onEdit }: { goal: Goal; onEdit: (goal: Goal) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <GoalCard
        goal={goal}
        actions={
          <>
            <button
              onClick={() => onEdit(goal)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit goal"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </>
        }
      />
    </div>
  );
}

function SortableGoalGrid({
  goals,
  onReorder,
  onEdit,
}: {
  goals: Goal[];
  onReorder: (goals: Goal[]) => void;
  onEdit: (goal: Goal) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = goals.findIndex((g) => g.id === active.id);
    const newIndex = goals.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(goals, oldIndex, newIndex);
    onReorder(reordered);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={goals.map((g) => g.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
          {goals.map((goal) => (
            <SortableGoalCard key={goal.id} goal={goal} onEdit={onEdit} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function GoalsClient({ goals: initialGoals }: { goals: Goal[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState(initialGoals);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setGoals(initialGoals);
  }, [initialGoals]);

  function handleEditGoal(goal: Goal) {
    setEditGoal(goal);
    setEditOpen(true);
  }

  const active = goals.filter((g) => g.status === "ACTIVE");
  const completed = goals.filter((g) => g.status === "COMPLETED");
  const paused = goals.filter((g) => ["PAUSED", "ABANDONED"].includes(g.status));

  const handleReorder = useCallback(async (reordered: Goal[]) => {
    setGoals((prev) => {
      const nonActive = prev.filter((g) => !reordered.find((r) => r.id === g.id));
      return [...reordered, ...nonActive];
    });
    await reorderGoals(
      reordered.map((g, i) => ({ id: g.id, order: i }))
    );
  }, []);

  return (
    <>
      <PageHeader
        section="Planning"
        title="Savings Goals"
        description={active.length > 0 ? `${active.length} active goal${active.length !== 1 ? "s" : ""} — save toward a target, track progress, link to a Savings Pot` : "Set a savings target with a deadline. Track progress and link to a Savings Pot."}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Goal
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="paused">Paused ({paused.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No active goals"
              description="Set goals for things you're saving toward — a new phone, gaming PC, vacation, anything!"
              action={{ label: "Create your first goal", onClick: () => setOpen(true) }}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">Drag cards to set priority — first card is highest priority</p>
              <SortableGoalGrid goals={active} onReorder={handleReorder} onEdit={handleEditGoal} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <EmptyState icon={Target} title="No completed goals yet" description="Keep going — you'll get there!" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
              {completed.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  actions={
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Edit goal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="paused" className="mt-4">
          {paused.length === 0 ? (
            <EmptyState icon={Target} title="No paused goals" description="All your goals are active!" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
              {paused.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  actions={
                    <button
                      onClick={() => handleEditGoal(goal)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Edit goal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
          </DialogHeader>
          <GoalForm onSuccess={() => { setOpen(false); router.refresh(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {editGoal && (
            <GoalForm
              goal={editGoal}
              onSuccess={() => { setEditOpen(false); router.refresh(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
