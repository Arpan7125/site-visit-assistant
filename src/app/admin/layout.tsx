import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { requireStaff } from "@/lib/authz";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Sales", template: "%s · Sales" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const links = [
    { href: "/admin/leads", label: "Leads" },
    ...(staff.role === "SALES_HEAD"
      ? [
          { href: "/admin/dashboard", label: "Dashboard" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <Link href="/admin/leads" className="font-display text-lg">
            Company A
          </Link>
          <AdminNav links={links} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">
              {staff.name}
              <span className="max-sm:hidden">, {staff.role === "SALES_HEAD" ? "Sales head" : "Sales executive"}</span>
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="min-h-9 rounded-md px-2 text-accent hover:bg-accent-soft">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
