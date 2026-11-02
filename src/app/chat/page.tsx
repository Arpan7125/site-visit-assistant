import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";
import { chatSessionId } from "@/lib/chat/session";
import { chatState } from "@/lib/chat/transcript";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const id = await chatSessionId();
  const initial = id ? await chatState(prisma, id) : null;
  const projects = await prisma.project.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, reraNumber: true } });
  const projectId = projects.some((p) => p.id === project) ? project : undefined;
  return <ChatApp initial={initial} projects={projects} projectHint={projectId} />;
}
