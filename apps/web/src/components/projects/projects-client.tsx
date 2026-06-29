"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectCard, ProjectCardData } from "@/components/projects/project-card";
import { ProjectForm } from "@/components/projects/project-form";

type Filter = "ALL" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
];

export function ProjectsClient({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");

  const visible = useMemo(
    () => (filter === "ALL" ? projects : projects.filter((p) => p.status === filter)),
    [projects, filter],
  );

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        section="Life"
        title="Projects"
        description="Freelance and client work — projects with their own tasks, statuses, and due dates."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-6">
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={projects.length === 0 ? "No projects yet" : "Nothing here"}
          description={
            projects.length === 0
              ? "Create a project to manage client or freelance work separately from your personal tasks."
              : "No projects match this filter."
          }
          action={projects.length === 0 ? { label: "New project", onClick: () => setOpen(true) } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
    </>
  );
}
