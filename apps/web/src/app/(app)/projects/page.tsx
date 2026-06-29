import { Metadata } from "next";
import { getProjects } from "@/actions/projects";
import { ProjectsClient } from "@/components/projects/projects-client";
import { ProjectCardData } from "@/components/projects/project-card";

export const metadata: Metadata = { title: "Projects — Coffer" };

export default async function ProjectsPage() {
  const projects = await getProjects();

  const cards: ProjectCardData[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    color: p.color,
    status: p.status,
    dueDate: p.dueDate,
    taskCount: p.tasks.length,
    doneCount: p.tasks.filter((t) => t.status === "DONE").length,
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <ProjectsClient projects={cards} />
    </div>
  );
}
