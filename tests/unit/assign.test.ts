import { describe, expect, it } from "vitest";
import { pickExecutive, type ExecLoad } from "@/lib/handoff/assign";

const at = (m: number) => new Date(Date.UTC(2026, 10, 1, 10, m));

describe("pickExecutive (load-weighted round-robin)", () => {
  it("picks the lowest open load", () => {
    const loads: ExecLoad[] = [
      { id: "a", name: "Aman", openLoad: 3, lastAssignedAt: null },
      { id: "b", name: "Bina", openLoad: 1, lastAssignedAt: at(50) },
      { id: "c", name: "Chirag", openLoad: 2, lastAssignedAt: null },
    ];
    expect(pickExecutive(loads)?.id).toBe("b");
  });

  it("breaks ties by least recently assigned, never-assigned first, then name", () => {
    const loads: ExecLoad[] = [
      { id: "a", name: "Aman", openLoad: 1, lastAssignedAt: at(30) },
      { id: "b", name: "Bina", openLoad: 1, lastAssignedAt: at(10) },
      { id: "c", name: "Chirag", openLoad: 1, lastAssignedAt: null },
      { id: "d", name: "Deep", openLoad: 1, lastAssignedAt: null },
    ];
    expect(pickExecutive(loads)?.id).toBe("c");
    expect(pickExecutive(loads.filter((l) => !["c", "d"].includes(l.id)))?.id).toBe("b");
  });

  it("rotates through equal executives as each one is assigned", () => {
    let loads: ExecLoad[] = ["Aman", "Bina", "Chirag"].map((name) => ({ id: name, name, openLoad: 0, lastAssignedAt: null }));
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const pick = pickExecutive(loads)!;
      order.push(pick.id);
      // Acknowledged straight away: load stays 0, only recency changes.
      loads = loads.map((l) => (l.id === pick.id ? { ...l, lastAssignedAt: at(i) } : l));
    }
    expect(order).toEqual(["Aman", "Bina", "Chirag", "Aman", "Bina", "Chirag"]);
  });

  it("returns null when nobody is active", () => expect(pickExecutive([])).toBeNull());
});
