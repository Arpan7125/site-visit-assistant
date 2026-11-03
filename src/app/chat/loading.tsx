import { Skeleton } from "@/components/ui";

export default function ChatLoading() {
  return (
    <main role="status" aria-label="Loading the chat" className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-5">
      <Skeleton className="h-9 w-56" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
      <Skeleton className="mt-auto mb-4 h-11 w-full" />
    </main>
  );
}
