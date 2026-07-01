"use client";

import { ProjectChatFull } from "@/components/projects/project-chat-full";

export default function ProjectChatPage({ params }: { params: { id: string } }) {
  return <ProjectChatFull projectId={params.id} />;
}
