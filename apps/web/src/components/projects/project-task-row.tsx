"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Circle, CircleDot, Eye, CheckCircle2, Trash2, Loader2, CalendarClock } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { updateProjectTask, deleteProjectTask } from "@/actions/projects";
import { cn, isOverdue } from "@/lib/utils";
import { PROJECT_TASK_PRIORITIES, PROJECT_TASK_PRIORITY_DOT } from "@/lib/constants";

export interface ProjectTaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  order: number;
}

// Forward cycle through the kanban statuses when the status icon is clicked.
const NEXT_STATUS: Record<string, string> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "REVIEW",
  REVIEW: "DONE",
  DONE: "TODO",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "IN_PROGRESS": return <CircleDot className="h-5 w-5 text-blue-500" />;
    case "REVIEW": return <Eye className="h-5 w-5 text-amber-500" />;
    case "DONE": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    default: return <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />;
  }
}

export function ProjectTaskRow({ task, onChange }: { task: ProjectTaskData; onChange: () => void }) {
  const [cycling, setCycling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);

  const done = task.status === "DONE";
  const overdue = isOverdue(task.dueDate) && !done;

  async function cycleStatus() {
    setCycling(true);
    const result = await updateProjectTask(task.id, { status: NEXT_STATUS[task.status] ?? "TODO" });
    if (result.success) onChange();
    else toast.error("Failed to update status");
    setCycling(false);
  }

  async function changePriority(priority: string) {
    const result = await updateProjectTask(task.id, { priority });
    if (result.success) onChange();
    else toast.error("Failed to update priority");
  }

  async function commitTitle() {
    const trimmed = titleValue.trim();
    setEditing(false);
    if (!trimmed || trimmed === task.title) {
      setTitleValue(task.title);
      return;
    }
    const result = await updateProjectTask(task.id, { title: trimmed });
    if (result.success) onChange();
    else { toast.error("Failed to rename"); setTitleValue(task.title); }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProjectTask(task.id);
    if (result.success) { toast.success("Task deleted"); onChange(); }
    else toast.error("Failed to delete");
    setDeleting(false);
    setDeleteOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-3 py-2.5 group">
        <button onClick={cycleStatus} disabled={cycling} className="shrink-0" aria-label="Cycle status">
          {cycling ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <StatusIcon status={task.status} />}
        </button>

        <span
          className={cn("h-2 w-2 rounded-full shrink-0", PROJECT_TASK_PRIORITY_DOT[task.priority])}
          title={`${task.priority} priority`}
        />

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                if (e.key === "Escape") { setTitleValue(task.title); setEditing(false); }
              }}
              className="w-full text-sm bg-transparent border-b border-primary outline-none py-0.5"
            />
          ) : (
            <span
              onClick={() => { setTitleValue(task.title); setEditing(true); }}
              className={cn("text-sm cursor-pointer select-none block truncate", done && "line-through text-muted-foreground")}
              title="Click to edit"
            >
              {task.title}
            </span>
          )}
          {task.dueDate && (
            <span className={cn("text-xs flex items-center gap-1 mt-0.5", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
              <CalendarClock className="h-3 w-3" />
              {overdue ? "Overdue · " : ""}{format(new Date(task.dueDate), "d MMM")}
            </span>
          )}
        </div>

        <Select value={task.priority} onValueChange={changePriority}>
          <SelectTrigger className="h-7 w-[92px] text-xs opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100">
            <span className="capitalize">{task.priority.toLowerCase()}</span>
          </SelectTrigger>
          <SelectContent>
            {PROJECT_TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="text-xs capitalize">{p.toLowerCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => setDeleteOpen(true)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-1.5 shrink-0"
          aria-label="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

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
