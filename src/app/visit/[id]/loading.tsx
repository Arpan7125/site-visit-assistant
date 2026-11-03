import { Skeleton } from "@/components/ui";

export default function VisitLoading() {
  return (
    <main role="status" aria-label="Loading your visit" className="mx-auto max-w-md px-5 py-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-9 w-48" />
      <Skeleton className="mt-6 h-72 w-full rounded-lg" />
    </main>
  );
}
