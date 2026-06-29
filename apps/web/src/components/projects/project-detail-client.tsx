"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, CalendarClock, User, Loader2, GripVertical,
} from "lucide-react";
import {
  DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectTaskRow, ProjectTaskData } from "@/components/projects/project-task-row";
import {
  createProjectTask, updateProject, deleteProject, reorderProjectTasks,
} from "@/actions/projects";
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  PROJECT_TASK_STATUSES, PROJECT_TASK_STATUS_LABELS,
} from "@/lib/constants";
import { cn, isOverdue } from "@/lib/utils";

export interface ProjectDetailData {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
  color: string;
  status: string;
  dueDate: Date | null;
  tasks: ProjectTaskData[];
}

function SortableTaskRow({ task, onChange }: { task: ProjectTaskData; onChange: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <ProjectTaskRow task={task} onChange={onChange} />
      </div>
    </div>
  );
}

export function ProjectDetailClient({ project }: { project: ProjectDetailData }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ProjectTaskData[]>(project.tasks);
  const [status, setStatus] = useState(project.status);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const overdue = isOverdue(project.dueDate) && status === "ACTIVE";

  useEffect(() => { setTasks(project.tasks); setStatus(project.status); }, [project]);

  function refresh() { router.refresh(); }

  async function changeStatus(next: string) {
    setStatus(next);
    const result = await updateProject(project.id, { status: next });
    if (result.success) refresh();
    else toast.error("Failed to update status");
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const result = await createProjectTask(project.id, { title });
    if (result.success) { setNewTitle(""); refresh(); }
    else toast.error(result.error ?? "Failed to add task");
    setAdding(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProject(project.id);
    if (result.success) { toast.success("Project deleted"); router.push("/projects"); }
    else { toast.error("Failed to delete"); setDeleting(false); setDeleteOpen(false); }
  }

  function handleDragEnd(groupStatus: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const group = tasks.filter((t) => t.status === groupStatus);
      const oldIndex = group.findIndex((t) => t.id === active.id);
      const newIndex = group.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(group, oldIndex, newIndex);

      // Merge the reordered group back into the full list, then persist new orders.
      const others = tasks.filter((t) => t.status !== groupStatus);
      setTasks([...others, ...reordered]);
      reorderProjectTasks(reordered.map((t, i) => ({ id: t.id, order: i + 1 })));
    };
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 relative overflow-hidden">
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: project.color }} aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground font-display">{project.name}</h1>
            {project.client && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <User className="h-3.5 w-3.5" />{project.client}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground p-2 transition-colors" aria-label="Edit project">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-red-500 p-2 transition-colors" aria-label="Delete project">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger className="h-7 w-auto gap-2 border-0 p-0 focus:ring-0">
              <Badge className={cn(PROJECT_STATUS_COLORS[status])}>{PROJECT_STATUS_LABELS[status]}</Badge>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {project.dueDate && (
            <span className={cn("inline-flex items-center gap-1 text-xs", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
              <CalendarClock className="h-3.5 w-3.5" />
              {overdue ? "Overdue · " : "Due "}{format(new Date(project.dueDate), "d MMM yyyy")}
            </span>
          )}
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">{project.description}</p>
        )}
      </div>

      {/* Task groups */}
      <div className="space-y-6">
        {PROJECT_TASK_STATUSES.map((groupStatus) => {
          const group = tasks.filter((t) => t.status === groupStatus);
          return (
            <section key={groupStatus}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1 flex items-center gap-2">
                {PROJECT_TASK_STATUS_LABELS[groupStatus]}
                <span className="text-muted-foreground/60">{group.length}</span>
              </h2>

              {group.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(groupStatus)}>
                  <SortableContext items={group.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y divide-border/40">
                      {group.map((t) => <SortableTaskRow key={t.id} task={t} onChange={refresh} />)}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {groupStatus === "TODO" && (
                <div className="flex gap-2 mt-2 pl-1">
                  <Input
                    placeholder="Add a task..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
                    className="h-9 text-sm"
                  />
                  <Button onClick={addTask} size="icon" className="h-9 w-9 shrink-0" disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {groupStatus !== "TODO" && group.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-1 py-1">Nothing here.</p>
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <ProjectForm
            project={project}
            onSuccess={() => { setEditOpen(false); refresh(); }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description="This deletes the project and all its tasks. This cannot be undone."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
