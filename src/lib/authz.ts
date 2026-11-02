import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { StaffRole } from "@/auth.config";

export type Staff = { id: string; name: string; email: string; role: StaffRole };

export async function currentStaff(): Promise<Staff | null> {
  const session = await auth();
  const u = session?.user as Partial<Staff> | undefined;
  if (!u?.id || !u.role) return null;
  return { id: u.id, name: u.name ?? "", email: u.email ?? "", role: u.role };
}

/** For server components and server actions: redirect if not allowed. */
export async function requireStaff(role?: StaffRole): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (role && staff.role !== role) redirect("/admin/leads?denied=1");
  return staff;
}

/** For route handlers: returns the staff user or a 401/403 response. */
export async function apiStaff(role?: StaffRole): Promise<Staff | NextResponse> {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (role && staff.role !== role) return NextResponse.json({ error: "Sales head only" }, { status: 403 });
  return staff;
}

/** Executives may change only leads assigned to them; the sales head may change any. */
export function canEditLead(staff: Staff, lead: { assignedExecId: string | null }): boolean {
  return staff.role === "SALES_HEAD" || lead.assignedExecId === staff.id;
}
