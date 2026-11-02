import { describe, expect, it } from "vitest";
import { costPerVisit, median, showUpRate } from "@/lib/dashboard/metrics";
import { planReminders } from "@/lib/reminders/schedule";
import { DAY, HOUR, MINUTE } from "@/lib/time";

describe("dashboard maths", () => {
  it("median handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("show-up rate = visited / (visited + no-show), undefined with no outcomes", () => {
    expect(showUpRate(3, 1)).toBe(0.75);
    expect(showUpRate(0, 2)).toBe(0);
    expect(showUpRate(0, 0)).toBeNull();
  });

  it("cost per visit pro-rates monthly spend to the period", () => {
    expect(costPerVisit(12_00_000, 30, 10)).toBe(1_20_000);
    expect(costPerVisit(12_00_000, 15, 10)).toBe(60_000);
    expect(costPerVisit(12_00_000, 30, 0)).toBeNull();
  });
});

describe("reminder timing rules", () => {
  const now = new Date("2026-11-02T04:00:00Z");
  it("two reminders for a visit days away", () => {
    expect(planReminders(new Date(now.getTime() + 3 * DAY), now).map((r) => r.kind)).toEqual(["T_MINUS_1D", "T_MINUS_2H"]);
  });
  it("only the 2-hour one for a visit tomorrow morning", () => {
    expect(planReminders(new Date(now.getTime() + 20 * HOUR), now).map((r) => r.kind)).toEqual(["T_MINUS_2H"]);
  });
  it("one immediate reminder when the visit is under 2 hours away", () => {
    const r = planReminders(new Date(now.getTime() + 90 * MINUTE), now);
    expect(r).toEqual([{ kind: "T_MINUS_2H", sendAt: now }]);
  });
  it("none for a visit that has started", () => {
    expect(planReminders(now, now)).toEqual([]);
  });
});
