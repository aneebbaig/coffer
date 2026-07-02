"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, CalendarClock, User, Loader2 } from "lucide-react";
import {
  DndContext, DragOverlay, closestCorners, DragEndEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectTaskCard, ProjectTaskData } from "@/components/projects/project-task-card";
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

type Columns = Record<string, ProjectTaskData[]>;

function bucket(tasks: ProjectTaskData[]): Columns {
  const cols: Columns = Object.fromEntries(PROJECT_TASK_STATUSES.map((s) => [s, []]));
  for (const t of tasks) (cols[t.status] ?? cols.TODO).push(t);
  return cols;
}

function findColumn(columns: Columns, id: string): string | undefined {
  return Object.keys(columns).find((s) => columns[s].some((t) => t.id === id));
}

function KanbanColumn({
  status, tasks, children,
}: { status: string; tasks: ProjectTaskData[]; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className="min-h-[120px]">
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">{children}</div>
      </SortableContext>
    </div>
  );
}

export function ProjectDetailClient({ project }: { project: ProjectDetailData }) {
  const router = useRouter();
  const [columns, setColumns] = useState<Columns>(() => bucket(project.tasks));
  const [activeTask, setActiveTask] = useState<ProjectTaskData | null>(null);
  const dragSnapshot = useRef<{ status: string; columns: Columns } | null>(null);
  const [status, setStatus] = useState(project.status);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const overdue = isOverdue(project.dueDate) && status === "ACTIVE";

  useEffect(() => {
    setColumns(bucket(project.tasks));
    setStatus(project.status);
  }, [project]);

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

  function handleDragStart(id: string) {
    const columnStatus = findColumn(columns, id);
    if (!columnStatus) return;
    setActiveTask(columns[columnStatus].find((t) => t.id === id) ?? null);
    dragSnapshot.current = { status: columnStatus, columns };
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setColumns((prev) => {
      const activeStatus = findColumn(prev, activeId);
      const overStatus = (PROJECT_TASK_STATUSES as readonly string[]).includes(overId)
        ? overId
        : findColumn(prev, overId);
      if (!activeStatus || !overStatus) return prev;

      const activeItems = prev[activeStatus];
      const activeIndex = activeItems.findIndex((t) => t.id === activeId);

      if (activeStatus === overStatus) {
        const overIndex = activeItems.findIndex((t) => t.id === overId);
        if (overIndex === -1 || activeIndex === overIndex) return prev;
        const reordered = [...activeItems];
        const [moved] = reordered.splice(activeIndex, 1);
        reordered.splice(overIndex, 0, moved);
        return { ...prev, [activeStatus]: reordered };
      }

      const destItems = prev[overStatus];
      const overIndex = destItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : destItems.length;
      const moved = { ...activeItems[activeIndex], status: overStatus };
      return {
        ...prev,
        [activeStatus]: activeItems.filter((t) => t.id !== activeId),
        [overStatus]: [...destItems.slice(0, insertAt), moved, ...destItems.slice(insertAt)],
      };
    });
  }

  function handleDragEnd({ active }: DragEndEvent) {
    setActiveTask(null);
    if (!active || !dragSnapshot.current) return;

    const activeId = String(active.id);
    const originalStatus = dragSnapshot.current.status;
    const finalStatus = findColumn(columns, activeId);
    if (!finalStatus) return;

    const updates: { id: string; order: number; status?: string }[] =
      columns[originalStatus].map((t, i) => ({ id: t.id, order: i + 1 }));

    if (finalStatus !== originalStatus) {
      updates.push(
        ...columns[finalStatus].map((t, i) => ({
          id: t.id,
          order: i + 1,
          ...(t.id === activeId && { status: finalStatus }),
        }))
      );
    }

    const snapshot = dragSnapshot.current.columns;
    reorderProjectTasks(updates).then((result) => {
      if (!result.success) {
        toast.error("Failed to move task");
        setColumns(snapshot);
      }
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
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

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => handleDragStart(String(e.active.id))}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PROJECT_TASK_STATUSES.map((columnStatus) => {
            const tasks = columns[columnStatus];
            return (
              <div key={columnStatus} className="w-72 shrink-0">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2 flex items-center gap-2">
                  {PROJECT_TASK_STATUS_LABELS[columnStatus]}
                  <span className="text-muted-foreground/60">{tasks.length}</span>
                </h2>

                {columnStatus === "TODO" && (
                  <div className="flex gap-2 mb-2">
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

                <KanbanColumn status={columnStatus} tasks={tasks}>
                  {tasks.map((t) => <ProjectTaskCard key={t.id} task={t} onChange={refresh} />)}
                  {tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 px-1 py-1">Nothing here.</p>
                  )}
                </KanbanColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? <ProjectTaskCard task={activeTask} onChange={refresh} dragging /> : null}
        </DragOverlay>
      </DndContext>

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
