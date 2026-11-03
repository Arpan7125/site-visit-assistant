// Captures the key screens of the live app into docs/screens/ for the TDD.
// Usage: node scripts/capture-screens.mjs <visitId> <leadId>
// The visit link is signed with LINK_SIGNING_SECRET from the git-ignored .env.vercel (never printed).
import { chromium, devices } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.SCREENS_BASE_URL || "https://site-visit-assistant.vercel.app";
const OUT = "docs/screens";
const [visitId, leadId] = process.argv.slice(2);
if (!visitId || !leadId) throw new Error("Usage: node scripts/capture-screens.mjs <visitId> <leadId>");
mkdirSync(OUT, { recursive: true });

const secret = readFileSync(".env.vercel", "utf8").match(/^LINK_SIGNING_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) throw new Error("LINK_SIGNING_SECRET missing in .env.vercel");
const exp = Math.floor(Date.now() / 1000) + 3 * 86400;
const token = `${exp}.${createHmac("sha256", secret).update(`visit:${visitId}:${exp}`).digest("base64url")}`;

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

// ---- Buyer, phone size ----
const phone = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
const p = await phone.newPage();
await p.goto(`${BASE}/`);
await shot(p, "01-landing");

await p.goto(`${BASE}/chat?project=vasant`);
await p.getByRole("button", { name: "English" }).click();
await p.getByText("virtual assistant for our homes").waitFor();
await p.getByLabel("Ask about the homes or a visit").fill("Is there a swimming pool at Vasant Residency?");
await p.keyboard.press("Enter");
// Acknowledgement, buyer question, then the assistant's reply.
await p.locator("ol > li:not([role=status])").nth(2).waitFor({ timeout: 30000 });
await p.waitForTimeout(600);
await shot(p, "02-chat-answer");

await p.getByRole("button", { name: "Book a site visit" }).click();
await p.locator("fieldset").last().waitFor();
await p.locator("fieldset").last().scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await shot(p, "03-slot-picker");

await p.goto(`${BASE}/visit/${visitId}?t=${token}`);
await p.getByText("Site visit booked").first().waitFor();
await shot(p, "04-visit-pass");

// ---- Staff, desktop ----
const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const d = await desk.newPage();
await d.goto(`${BASE}/login`);
await shot(d, "05-login");
await d.getByLabel("Work email").fill("head@companya.test");
await d.getByLabel("Password").fill("head-demo-2026");
await d.getByRole("button", { name: "Sign in" }).click();
await d.waitForURL(/\/admin\/leads/);
await d.getByRole("table").waitFor();
await shot(d, "06-leads");

await d.goto(`${BASE}/admin/leads/${leadId}`);
await d.getByRole("heading", { name: "Handoff" }).waitFor();
await shot(d, "07-lead-handoff");

await d.goto(`${BASE}/admin/dashboard`);
await d.getByRole("heading", { name: "By source" }).waitFor();
await shot(d, "08-dashboard");

await d.goto(`${BASE}/admin/settings?tab=facts`);
await d.getByRole("table").waitFor();
await shot(d, "09-fact-sheet");

await d.goto(`${BASE}/admin/settings?tab=messages`);
await d.getByRole("heading", { name: "Sent and skipped" }).waitFor();
await shot(d, "10-message-log");

await browser.close();
console.log(`Saved 10 screenshots to ${OUT}/`);
