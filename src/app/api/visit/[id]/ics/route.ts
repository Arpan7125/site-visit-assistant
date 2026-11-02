import { NextResponse } from "next/server";
import { visitIcs } from "@/lib/booking/ics";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/links";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t");
  if (!verifyToken("visit", id, token)) return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  const v = await prisma.visit.findUnique({ where: { id }, include: { slot: { include: { project: true } } } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = v.slot.project;
  const body = visitIcs({ id: v.id, startsAt: v.slot.startsAt, endsAt: v.slot.endsAt, projectName: p.name, address: p.address, mapUrl: p.mapUrl, reraNumber: p.reraNumber });
  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="site-visit-${p.id}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
