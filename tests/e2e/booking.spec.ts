import { expect, test, type Page } from "@playwright/test";

async function startChat(page: Page) {
  await page.goto("/chat?project=vasant");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("virtual assistant for our homes")).toBeVisible();
}

async function saveContact(page: Page, name: string, phone?: string) {
  await page.getByLabel("Name").fill(name);
  if (phone) {
    await page.getByRole("checkbox").check();
    await page.getByLabel("Mobile number").fill(phone);
  }
  await page.getByRole("button", { name: "Save details" }).click();
}

test("buyer books a real free slot; a second buyer on the same slot gets alternatives; executive sees the lead", async ({ browser }) => {
  test.setTimeout(180_000); // three browsers, and the dev server compiles routes on first use
  // Buyer A opens the picker.
  const a = await (await browser.newContext()).newPage();
  await startChat(a);
  await a.getByRole("button", { name: "Book a site visit" }).click();
  const firstSlot = a.locator("fieldset button").first();
  const slotLabel = (await firstSlot.getAttribute("aria-label"))!;

  // Buyer B opens the picker at the same time and sees the same slot.
  const b = await (await browser.newContext()).newPage();
  await startChat(b);
  await b.getByRole("button", { name: "Book a site visit" }).click();
  await expect(b.getByRole("button", { name: slotLabel })).toBeVisible();

  // A books it.
  await firstSlot.click();
  await saveContact(a, "E2E Buyer A", "98250 77001");
  await expect(a.getByRole("region", { name: "Site visit booked" })).toBeVisible();
  await expect(a.getByText("RERA No.")).toBeVisible();
  await expect(a.getByRole("link", { name: "Open map" })).toHaveAttribute("href", /google\.com\/maps/);

  // B tries the same slot a moment later: told it's taken, offered the nearest free times.
  await b.getByRole("button", { name: slotLabel }).click();
  await saveContact(b, "E2E Buyer B");
  await expect(b.getByText("Someone just booked that time")).toBeVisible();
  await expect(b.locator("fieldset").last().getByRole("button", { name: slotLabel })).toHaveCount(0);

  // A asks for a person: handoff to a named executive.
  await a.getByRole("button", { name: "Talk to a person" }).click();
  const passed = a.getByText(/Passed to /).last();
  await expect(passed).toBeVisible();
  const execName = (await passed.textContent())!.replace(/.*Passed to\s*/, "").trim();

  // The sales head finds the lead with the booked visit and the handoff summary.
  const staff = await (await browser.newContext()).newPage();
  await staff.goto("/login");
  await staff.getByLabel("Work email").fill("head@companya.test");
  await staff.getByLabel("Password").fill("head-demo-2026");
  await staff.getByRole("button", { name: "Sign in" }).click();
  await expect(staff).toHaveURL(/\/admin\/leads/);
  await staff.goto("/admin/leads?q=E2E%20Buyer%20A");
  await staff.getByRole("link", { name: "E2E Buyer A" }).first().click();
  await expect(staff.getByRole("heading", { name: "Handoff" })).toBeVisible();
  await expect(staff.getByText("Buyer asked for a person").first()).toBeVisible();
  await expect(staff.locator("article").getByText(execName, { exact: true })).toBeVisible();
  await expect(staff.getByText("Booked").first()).toBeVisible();
});

test("roles are enforced on the server", async ({ browser, request }) => {
  // Unauthenticated: admin API and pages are closed.
  expect((await request.post("/api/admin/slots", { data: { action: "toggle", slotId: "x", active: false } })).status()).toBe(401);
  expect((await request.post("/api/admin/leads/LD-58210", { data: { action: "reveal" } })).status()).toBe(401);
  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/admin/leads");
  await expect(anon).toHaveURL(/\/login/);

  // Executive: head-only pages and APIs are refused.
  const ctx = await browser.newContext();
  const exec = await ctx.newPage();
  await exec.goto("/login");
  await exec.getByLabel("Work email").fill("riya@companya.test");
  await exec.getByLabel("Password").fill("exec-demo-2026");
  await exec.getByRole("button", { name: "Sign in" }).click();
  await expect(exec).toHaveURL(/\/admin\/leads/);
  await exec.goto("/admin/dashboard");
  await expect(exec).toHaveURL(/denied=1/);
  expect((await ctx.request.post("/api/admin/facts", { data: {} })).status()).toBe(403);
  expect((await ctx.request.post("/api/admin/leads/LD-58210", { data: { action: "erase", confirm: "DELETE" } })).status()).toBe(403);

  // Cron needs its secret.
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
});
