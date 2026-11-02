import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { apiStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { deleteFact, saveFact } from "@/lib/facts/admin";

export async function POST(req: Request) {
  const staff = await apiStaff("SALES_HEAD");
  if (staff instanceof NextResponse) return staff;
  try {
    const entry = await saveFact(prisma, await req.json(), staff);
    return NextResponse.json(entry);
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "BAD_REQUEST", issues: e.issues }, { status: 400 });
    if (e instanceof Error && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "An entry with this topic already exists for this project" }, { status: 409 });
    }
    throw e;
  }
}

const delSchema = z.object({ id: z.string().min(1).max(40) }).strict();

export async function DELETE(req: Request) {
  const staff = await apiStaff("SALES_HEAD");
  if (staff instanceof NextResponse) return staff;
  const parsed = delSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  await deleteFact(prisma, parsed.data.id, staff.id);
  return NextResponse.json({ ok: true });
}

