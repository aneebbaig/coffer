"use client";

import { format } from "date-fns";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Loader2, CalendarClock, GripVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TaskStatusIcon } from "@/components/projects/task-status-icon";
import { useProjectTaskActions } from "@/components/projects/use-project-task-actions";
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

export function ProjectTaskCard({
  task, onChange, dragging = false,
}: { task: ProjectTaskData; onChange: () => void; dragging?: boolean }) {
  const {
    cycling, cycleStatus, changePriority,
    editing, titleValue, setTitleValue, startEditing, commitTitle, cancelEditing,
    deleteOpen, setDeleteOpen, deleting, handleDelete,
  } = useProjectTaskActions(task, onChange);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const done = task.status === "DONE";
  const overdue = isOverdue(task.dueDate) && !done;

  return (
    <>
      <div
        ref={dragging ? undefined : setNodeRef}
        style={dragging ? undefined : style}
        className={cn(
          "bg-card border border-border rounded-lg p-3 group/card",
          dragging && "shadow-lg rotate-1",
        )}
      >
        <div className="flex items-start gap-2">
          {!dragging && (
            <button
              {...attributes}
              {...listeners}
              className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none mt-0.5"
              aria-label="Drag to move"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <button onClick={cycleStatus} disabled={cycling} className="shrink-0" aria-label="Cycle status">
            {cycling ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <TaskStatusIcon status={task.status} />}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  if (e.key === "Escape") cancelEditing();
                }}
                className="w-full text-sm bg-transparent border-b border-primary outline-none py-0.5"
              />
            ) : (
              <span
                onClick={startEditing}
                className={cn("text-sm cursor-pointer select-none block", done && "line-through text-muted-foreground")}
                title="Click to edit"
              >
                {task.title}
              </span>
            )}

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={cn("h-2 w-2 rounded-full shrink-0", PROJECT_TASK_PRIORITY_DOT[task.priority])}
                title={`${task.priority} priority`}
              />
              {task.dueDate && (
                <span className={cn("text-xs flex items-center gap-1", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                  <CalendarClock className="h-3 w-3" />
                  {overdue ? "Overdue · " : ""}{format(new Date(task.dueDate), "d MMM")}
                </span>
              )}
            </div>
          </div>

          {!dragging && (
            <div className="flex flex-col items-end gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
              <Select value={task.priority} onValueChange={changePriority}>
                <SelectTrigger className="h-6 w-[80px] text-xs">
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
                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!dragging && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete task?"
          description="This cannot be undone."
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </>
  );
}
