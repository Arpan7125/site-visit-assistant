import { PrismaClient, type LeadSource } from "@prisma/client";
import { hashPhone } from "@/lib/leads/phone";
import { HOUR } from "@/lib/time";

export const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST });

export async function resetDb() {
  await db.$executeRawUnsafe(`
    TRUNCATE "ActivityLog","ReminderOutbox","Handoff","Visit","VisitSlot","ChatMessage",
      "ChatSession","Lead","FactSheetEntry","MessageTemplate","Project","User" RESTART IDENTITY CASCADE`);
}

let seq = 0;

export async function makeProject(id = "p1") {
  return db.project.create({
    data: {
      id,
      name: `Test Project ${id}`,
      reraNumber: `PR/GJ/TEST/${id}`,
      address: "Test Road, Ahmedabad",
      locality: "Shela",
      lat: 23.0,
      lng: 72.5,
      mapUrl: "https://maps.google.com/?q=23.0,72.5",
      tagline: "test",
    },
  });
}

export async function makeSlot(projectId: string, startsAt: Date, extra: { isActive?: boolean } = {}) {
  return db.visitSlot.create({
    data: { projectId, startsAt, endsAt: new Date(startsAt.getTime() + HOUR), ...extra },
  });
}

export async function makeLead(
  opts: { phone?: string; consent?: boolean; optedOut?: boolean; source?: LeadSource; projectId?: string; name?: string } = {},
) {
  seq += 1;
  const phone = opts.phone ?? `+9198${String(76500000 + seq).padStart(8, "0")}`;
  return db.lead.create({
    data: {
      id: `LD-T${String(seq).padStart(4, "0")}`,
      name: opts.name ?? `Test Lead ${seq}`,
      phoneE164: phone,
      phoneHash: hashPhone(phone),
      source: opts.source ?? "WEBSITE",
      projectId: opts.projectId,
      consentContact: opts.consent ?? true,
      consentAt: opts.consent === false ? null : new Date(),
      optedOut: opts.optedOut ?? false,
    },
  });
}

export async function makeExec(name: string, role: "EXECUTIVE" | "SALES_HEAD" = "EXECUTIVE") {
  return db.user.create({
    data: { name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@test.local`, passwordHash: "x", role },
  });
}
