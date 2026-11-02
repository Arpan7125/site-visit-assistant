import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function LeadNotFound() {
  return (
    <EmptyState title="No lead with that ID" action={<Link href="/admin/leads" className="font-medium text-accent underline underline-offset-4">Back to all leads</Link>}>
      Check the ID, or search the list by name or the last 4 digits of the phone number.
    </EmptyState>
  );
}
