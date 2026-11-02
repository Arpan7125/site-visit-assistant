-- Layer 2 of the no-double-booking guarantee (layer 1 is SELECT ... FOR UPDATE in bookVisit).
-- At most one BOOKED visit per slot. Cancelled / completed / no-show rows are kept for history.
CREATE UNIQUE INDEX "visit_one_booked_per_slot" ON "Visit" ("slotId") WHERE "status" = 'BOOKED';

-- One family per slot per project (Assumption A4). The partial index above is what enforces it,
-- so capacity is pinned to 1 until multi-capacity slots are designed properly.
ALTER TABLE "VisitSlot" ADD CONSTRAINT "visit_slot_capacity_one" CHECK ("capacity" = 1);
ALTER TABLE "VisitSlot" ADD CONSTRAINT "visit_slot_ends_after_start" CHECK ("endsAt" > "startsAt");
