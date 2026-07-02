import { useState } from "react";
import { toast } from "sonner";
import { updateProjectTask, deleteProjectTask } from "@/actions/projects";
import { ProjectTaskData } from "@/components/projects/project-task-card";

const NEXT_STATUS: Record<string, string> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "REVIEW",
  REVIEW: "DONE",
  DONE: "TODO",
};

export function useProjectTaskActions(task: ProjectTaskData, onChange: () => void) {
  const [cycling, setCycling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);

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

  function startEditing() {
    setTitleValue(task.title);
    setEditing(true);
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

  function cancelEditing() {
    setTitleValue(task.title);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProjectTask(task.id);
    if (result.success) { toast.success("Task deleted"); onChange(); }
    else toast.error("Failed to delete");
    setDeleting(false);
    setDeleteOpen(false);
  }

  return {
    cycling,
    cycleStatus,
    changePriority,
    editing,
    titleValue,
    setTitleValue,
    startEditing,
    commitTitle,
    cancelEditing,
    deleteOpen,
    setDeleteOpen,
    deleting,
    handleDelete,
  };
}
