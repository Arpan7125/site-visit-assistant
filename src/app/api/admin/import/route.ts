import { NextResponse } from "next/server";
import { apiStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { importLeadsCsv } from "@/lib/leads/csv";

const MAX_BYTES = 1_000_000;

/** Portal CSV import (sales head). Every rejected row comes back with its line and reason. */
export async function POST(req: Request) {
  const staff = await apiStaff("SALES_HEAD");
  if (staff instanceof NextResponse) return staff;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a CSV file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 1 MB" }, { status: 413 });
  const projects = await prisma.project.findMany();
  const projectIds: Record<string, string> = {};
  for (const p of projects) {
    projectIds[p.id] = p.id;
    projectIds[p.name.toLowerCase()] = p.id;
  }
  projectIds["project 1"] = "aranya";
  projectIds["project 2"] = "vasant";
  const summary = await importLeadsCsv(prisma, await file.text(), { actorId: staff.id, projectIds });
  return NextResponse.json(summary);
}
