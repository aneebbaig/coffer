"use client";

import { useState } from "react";
import { CheckCircle, Circle, Trash2, AlertCircle, Pencil, ChevronDown, ChevronUp, Plus, GripVertical, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { updateTaskStatus, deleteTask, updateTaskItems } from "@/actions/tasks";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isOverdue } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TaskMilestone } from "@/types";
import { TaskForm } from "@/components/tasks/task-form";
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

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: Date | null;
  dueTime: string | null;
  category: string | null;
  order?: number;
  items?: string;
}

function SortableMilestone({
  item,
  onToggle,
  onRemove,
  onRename,
}: {
  item: TaskMilestone;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.name) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 p-1 -ml-1"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          item.completed ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"
        )}
      >
        {item.completed && <Check className="h-3 w-3 text-white" />}
      </button>
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
            if (e.key === "Escape") { setEditValue(item.name); setEditing(false); }
          }}
          className="flex-1 text-sm bg-transparent border-b border-primary outline-none py-0.5"
        />
      ) : (
        <span
          onClick={() => { setEditValue(item.name); setEditing(true); }}
          className={cn("flex-1 text-sm cursor-pointer select-none", item.completed && "line-through text-muted-foreground")}
          title="Tap to edit"
        >
          {item.name}
        </span>
      )}
      <button onClick={onRemove} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1.5 -mr-1">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TaskCard({ task, onDeleted }: { task: Task; onDeleted?: () => void }) {
  const [done, setDone] = useState(task.status === "DONE");
  const [completing, setCompleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [milestones, setMilestones] = useState<TaskMilestone[]>(() => {
    try { return JSON.parse(task.items ?? "[]"); } catch { return []; }
  });
  const [newMilestone, setNewMilestone] = useState("");
  const [savingItems, setSavingItems] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const isMilestone = task.type === "MILESTONE";
  const completedCount = milestones.filter((m) => m.completed).length;
  const overdue = isOverdue(task.dueDate) && task.type === "ONE_TIME" && !done;

  async function handleToggle() {
    if (isMilestone) return;
    setCompleting(true);
    const newStatus = done ? "PENDING" : "DONE";
    const result = await updateTaskStatus(task.id, newStatus);
    if (result.success) {
      setDone(!done);
      toast.success(done ? "Task reopened" : "Task completed!");
    } else {
      toast.error("Failed to update task");
    }
    setCompleting(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteTask(task.id);
    if (result.success) {
      toast.success("Task deleted");
      onDeleted?.();
    } else {
      toast.error("Failed to delete");
    }
    setDeleting(false);
    setDeleteOpen(false);
  }

  async function handleMilestoneDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = milestones.findIndex((m) => m.id === active.id);
    const newIndex = milestones.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(milestones, oldIndex, newIndex);
    setMilestones(reordered);
    await updateTaskItems(task.id, reordered);
  }

  async function toggleMilestone(id: string) {
    const updated = milestones.map((m) => m.id === id ? { ...m, completed: !m.completed } : m);
    setMilestones(updated);
    setSavingItems(true);
    await updateTaskItems(task.id, updated);
    setSavingItems(false);
    if (updated.every((m) => m.completed) && updated.length > 0) {
      toast.success("All milestones complete! 🎉");
    }
  }

  async function removeMilestone(id: string) {
    const updated = milestones.filter((m) => m.id !== id);
    setMilestones(updated);
    setSavingItems(true);
    await updateTaskItems(task.id, updated);
    setSavingItems(false);
  }

  async function renameMilestone(id: string, newName: string) {
    const updated = milestones.map((m) => m.id === id ? { ...m, name: newName } : m);
    setMilestones(updated);
    setSavingItems(true);
    await updateTaskItems(task.id, updated);
    setSavingItems(false);
  }

  async function addMilestone() {
    if (!newMilestone.trim()) return;
    const newItem: TaskMilestone = { id: crypto.randomUUID(), name: newMilestone.trim(), completed: false };
    const updated = [...milestones, newItem];
    setMilestones(updated);
    setNewMilestone("");
    setSavingItems(true);
    await updateTaskItems(task.id, updated);
    setSavingItems(false);
  }

  return (
    <>
      <div className={cn(
        "border-b border-border/40 last:border-0 transition-all group",
        overdue && "bg-red-50/20 dark:bg-red-950/10 -mx-1 px-1 rounded-lg"
      )}>
        {/* Main row */}
        <div className={cn("flex items-start gap-3 py-3.5", done && "opacity-55")}>
          {!isMilestone ? (
            <button onClick={handleToggle} disabled={completing} className="mt-0.5 shrink-0 p-0.5 -ml-0.5">
              {completing ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : done ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground hover:text-emerald-500 transition-colors" />
              )}
            </button>
          ) : (
            <button onClick={() => setExpanded((v) => !v)} className="mt-0.5 shrink-0">
              {milestones.length > 0 && milestones.every((m) => m.completed) ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span className={cn("text-sm font-medium", done && "line-through text-muted-foreground", overdue && "text-red-700 dark:text-red-300")}>
                {task.title}
              </span>
              {overdue && <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              {task.category && <Badge variant="secondary" className="text-xs">{task.category}</Badge>}
              {isMilestone && milestones.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{milestones.length} done
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
            )}
            {task.dueDate && !isMilestone && (
              <div className={cn("text-xs mt-1", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                {overdue ? "OVERDUE · " : "Due: "}
                {format(new Date(task.dueDate), "d MMM yyyy")}
                {task.dueTime && ` at ${task.dueTime}`}
              </div>
            )}
            {isMilestone && milestones.length > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-[200px]">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {isMilestone && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Milestone items (expanded) */}
        {isMilestone && expanded && (
          <div className="px-1 pb-4 border-t border-border/40 pt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Tap item name to edit</p>
              {savingItems && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {milestones.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMilestoneDragEnd}>
                <SortableContext items={milestones.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                  {milestones.map((m) => (
                    <SortableMilestone
                      key={m.id}
                      item={m}
                      onToggle={() => toggleMilestone(m.id)}
                      onRemove={() => removeMilestone(m.id)}
                      onRename={(name) => renameMilestone(m.id, name)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">No milestones yet. Add one below.</p>
            )}
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Add milestone..."
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMilestone())}
                className="flex-1 h-9 text-sm"
              />
              <Button onClick={addMilestone} size="icon" className="h-9 w-9 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={task}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description="This cannot be undone."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
