import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { ProjectDetailClient, ProjectDetailData } from "@/components/projects/project-detail-client";

export const metadata: Metadata = { title: "Project — Coffer" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const data: ProjectDetailData = {
    id: project.id,
    name: project.name,
    description: project.description,
    client: project.client,
    color: project.color,
    status: project.status,
    dueDate: project.dueDate,
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      order: t.order,
    })),
  };

  return <ProjectDetailClient project={data} />;
}
