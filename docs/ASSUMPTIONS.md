# Assumptions

Everything here was invented because the brief did not say. Each item is labelled "Assumption" in the TDD.

| # | Area | Assumption | Why |
|---|---|---|---|
| A1 | Projects | "Project 1" is shown as **Aranya Heights** (Shela, Ahmedabad) and "Project 2" as **Vasant Residency** (Gota, Ahmedabad). Both fictional. | Brief only says Project 1 / Project 2. |
| A2 | RERA | RERA numbers are clearly fake: `PR/GJ/AHMEDABAD/DEMO/RAA00001/2026` and `PR/GJ/AHMEDABAD/DEMO/RAA00002/2026`. | No real numbers given; must not look real. |
| A3 | Fact sheet | All fact sheet contents (carpet areas, amenities, possession, parking, approvals, indicative "starting from" prices) are invented. Some topics are deliberately missing (e.g. pet policy, maintenance charges) to show the handoff path. | Brief says the assistant answers from a fact sheet but gives none. |
| A4 | Slots | Site visits: Tue–Sun, 10:00–17:00 IST, 1-hour slots, capacity 1 per project per slot. Mondays closed. | Not specified. |
| A5 | Staff | 6 fictional sales executives and 1 sales head; demo passwords only. | Brief says 11 in sales; 6 is enough to demo assignment. |
| A6 | Cost per visit | Monthly spend per source is assumed: Portal ₹12L, Social ad ₹9L, Website ₹3L, Hoarding ₹4L, WhatsApp ₹2L (total ₹30L, matching the brief's ₹30 lakh/month). Stored in config. | Brief gives total spend and ₹1,000/lead but not a per-source split. |
| A7 | Sample visit | LD-58210's visit (2026-11-01 11:00 IST) is in the past relative to build date; it is seeded as COMPLETED (visited) so dashboards count it. | Brief says "Booked"; the date has passed. |
| A8 | Handoff trigger | "Serious buyer" = budget given + BHK given + visit booked or requested. | Brief says "serious buyers" without definition. |
| A9 | Opt-out phrases | stop / unsubscribe / band karo / बंद करो / બંધ કરો and close variants. | DPDP requires honouring opt-outs; phrases not given. |
| A10 | Reminder channel | Mock WhatsApp if consented; messages are written to a Message log instead of being sent. | WhatsApp API out of scope; brief says mock outside systems. |
| A11 | Language detection | Script-based (Devanagari → Hindi, Gujarati script → Gujarati, else English); buyer can override with the switcher. Romanised Hindi is treated as English unless switched. | Simple, deterministic, testable. |
| A12 | Portal consent | Leads imported from portal CSVs are stored with `consentContact = false`; DPDP consent is not assumed from a third-party export. An executive confirms consent on the first call. | Safer reading of DPDP; brief does not say what portals capture. |
| A13 | Demo phone numbers | Seed phone numbers are made up (98xx/99xx patterns that pass validation). They are never dialled or messaged: all outbound channels are mocked. | Need valid-looking numbers to show normalisation and dedupe. |
| A14 | Chat leads | Every web chat creates a lead (source WEBSITE, name "Web visitor") so first response time is measured from the first second. The name and phone are filled in when the buyer shares them. | "Every enquiry answered" means every chat is an enquiry. |
| A15 | Booking needs a name | The assistant books only after the buyer gives a name (phone optional, consent-gated). Without a phone there are no reminders, and the card says so. | A site office needs to know who is coming. |
| A16 | Model | The live demo runs on Google Gemini (`gemini-3.5-flash-lite`, set by `AI_PROVIDER=gemini`, `GEMINI_MODEL`, `GEMINI_THINKING=LOW`) because the Anthropic account available had no API credit. Claude (`claude-opus-5-5` at low effort) remains supported through the same interface. 8 s deadline per buyer message, no SDK retries; on timeout the fixed outage reply and a handoff are used. | Brief requires a 2-minute answer; a slow or unavailable model must never leave a buyer waiting. |
