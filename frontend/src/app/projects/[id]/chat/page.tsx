"use client";

import { use } from "react";
import { ProjectChatFull } from "@/components/projects/project-chat-full";

export default function ProjectChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectChatFull projectId={id} />;
}
