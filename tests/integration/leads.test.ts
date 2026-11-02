import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createLead, resolvePossibleDuplicate } from "@/lib/leads/create";
import { importLeadsCsv } from "@/lib/leads/csv";
import { db, makeExec, makeProject, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("duplicate detection", () => {
  it("links all three phone spellings to the first lead and merges source tags", async () => {
    await makeProject("p1");
    const a = await createLead(db, { name: "Hardik Patel", phone: "98765 43210", source: "PORTAL", projectId: "p1" });
    const b = await createLead(db, { name: "H. Patel", phone: "+91-9876543210", source: "SOCIAL_AD" });
    const c = await createLead(db, { name: "Hardik", phone: "09876543210", source: "WEBSITE" });

    expect(a.duplicate).toBe("NONE");
    expect(b).toMatchObject({ duplicate: "CONFIRMED", originalId: a.lead.id });
    expect(c).toMatchObject({ duplicate: "CONFIRMED", originalId: a.lead.id });
    const original = await db.lead.findUniqueOrThrow({ where: { id: a.lead.id } });
    expect(original.extraSources.sort()).toEqual(["SOCIAL_AD", "WEBSITE"]);
    expect(b.lead.id).toMatch(/^LD-\d{5}$/);
  });

  it("flags a similar name on the same project as a possible duplicate, then merge/dismiss", async () => {
    await makeProject("p2");
    const head = await makeExec("Head", "SALES_HEAD");
    const orig = await createLead(db, { name: "Nidhi Shah", phone: "9824011111", source: "SOCIAL_AD", projectId: "p2" });
    const near = await createLead(db, { name: "Nidhi Shaah", phone: "9824022222", source: "HOARDING_CALL", projectId: "p2" });
    const other = await createLead(db, { name: "Nidhi Shaah", phone: "9824033333", source: "WEBSITE" }); // no project

    expect(near).toMatchObject({ duplicate: "POSSIBLE", originalId: orig.lead.id });
    expect(other.duplicate).toBe("NONE");

    await resolvePossibleDuplicate(db, { leadId: near.lead.id, action: "merge", actorId: head.id });
    expect((await db.lead.findUniqueOrThrow({ where: { id: near.lead.id } })).duplicateState).toBe("CONFIRMED");
    expect((await db.lead.findUniqueOrThrow({ where: { id: orig.lead.id } })).extraSources).toContain("HOARDING_CALL");

    const near2 = await createLead(db, { name: "Nidhi Sha", phone: "9824044444", source: "PORTAL", projectId: "p2" });
    await resolvePossibleDuplicate(db, { leadId: near2.lead.id, action: "dismiss", actorId: head.id });
    expect(await db.lead.findUniqueOrThrow({ where: { id: near2.lead.id } })).toMatchObject({
      duplicateState: "DISMISSED",
      duplicateOfId: null,
    });
    expect(await db.activityLog.count({ where: { action: { startsWith: "lead.duplicate_" } } })).toBe(2);
  });
});

describe("CSV import", () => {
  it("imports good rows, reports bad rows with line and field, and dedupes", async () => {
    await makeProject("p1");
    const csv = [
      "name,phone,source,project,bhk",
      "Rohan Mehta,98250 12345,Property portal,aranya,3",
      "Bad Phone,12345,portal,aranya,2",
      "No Source,9825011111,billboard,,2",
      "Rohan M,+91 98250 12345,whatsapp,,",
      "Wrong Project,9825022222,website,unknown,2",
      "X,9825033333,website,,2",
    ].join("\n");
    const res = await importLeadsCsv(db, csv, { actorId: null, projectIds: { aranya: "p1" } });

    expect(res.created).toBe(2);
    expect(res.duplicates).toBe(1);
    expect(res.errors).toEqual([
      { row: 3, field: "phone", message: "Not a valid Indian phone number" },
      { row: 4, field: "source", message: 'Unknown source "billboard"' },
      { row: 6, field: "project", message: 'Unknown project "unknown"' },
      expect.objectContaining({ row: 7, field: "name" }),
    ]);
  });

  it("rejects a file without required columns", async () => {
    const res = await importLeadsCsv(db, "phone\n9825012345", { actorId: null, projectIds: {} });
    expect(res.errors[0]).toMatchObject({ row: 1, field: "header" });
    expect(res.created).toBe(0);
  });
});
