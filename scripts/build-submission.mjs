// Builds the submission: submission/TDD.pdf (rendered Mermaid diagrams + screenshots) and
// submission/site-visit-assistant-submission.zip containing exactly TDD.pdf and deployment.md.
// Usage: node scripts/build-submission.mjs
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Marked } from "marked";

const OUT = "submission";
mkdirSync(OUT, { recursive: true });

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${escape(text)}</pre>`;
      return `<pre><code>${escape(text)}</code></pre>`;
    },
  },
});
const body = marked.parse(readFileSync("docs/TDD.md", "utf8"));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Technical design: AI lead response and site-visit booking</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Hind:wght@400;500;600&family=Hind+Vadodara:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  :root { --ink:#1b2420; --muted:#5d6661; --line:#e2ded5; --accent:#2d5443; --paper:#ffffff; --tint:#f6f4ef; }
  html { background: var(--paper); color: var(--ink); }
  body { font-family: Hind, "Hind Vadodara", "Segoe UI", sans-serif; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  h1, h2, h3 { font-family: Newsreader, Georgia, serif; font-weight: 400; color: var(--ink); line-height: 1.2; }
  h1 { font-size: 24pt; margin: 0 0 6mm; }
  h2 { font-size: 16pt; margin: 9mm 0 3mm; padding-top: 2mm; border-top: 1px solid var(--line); break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 6mm 0 2mm; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: var(--accent); text-decoration: none; }
  code { font-family: "Cascadia Mono", Consolas, monospace; font-size: 9pt; background: var(--tint); padding: 0 3px; border-radius: 3px; }
  pre { background: var(--tint); padding: 3mm; border-radius: 4px; overflow: hidden; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  pre.mermaid { background: none; text-align: center; padding: 0; margin: 4mm 0; }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9pt; break-inside: auto; }
  th, td { border-bottom: 1px solid var(--line); padding: 1.6mm 2mm; text-align: left; vertical-align: top; }
  th { color: var(--muted); font-weight: 500; }
  tr { break-inside: avoid; }
  .shots { text-align: center; margin: 4mm 0 1mm; break-inside: avoid; }
  .shots img { border: 1px solid var(--line); border-radius: 6px; margin: 0 2mm 2mm; vertical-align: top; max-width: 100%; height: auto; }
  .caption { text-align: center; color: var(--muted); font-size: 9pt; margin: 0 0 5mm; }
</style></head>
<body>${body}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict", fontFamily: "Hind, sans-serif" });
  try {
    await mermaid.run({ querySelector: "pre.mermaid" });
  } catch (e) {
    document.body.dataset.error = String(e && e.message ? e.message : e);
  }
  document.body.dataset.ready = "1";
</script>
</body></html>`;

// Written next to the TDD so relative screenshot paths (screens/...) resolve.
const htmlPath = path.resolve("docs/.tdd-print.html");
writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.waitForSelector("body[data-ready='1']", { state: "attached", timeout: 60000 });
const renderError = await page.evaluate(() => document.body.dataset.error);
if (renderError) throw new Error(`Mermaid failed: ${renderError}`);
const diagrams = await page.locator("pre.mermaid svg").count();
const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
await page.pdf({
  path: `${OUT}/TDD.pdf`,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font: 8pt Segoe UI, sans-serif; color:#5d6661; width:100%; text-align:center;">Site-visit assistant, technical design · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" },
});
await browser.close();
rmSync(htmlPath);

copyFileSync("deployment.md", `${OUT}/deployment.md`);
const zip = path.resolve(OUT, "site-visit-assistant-submission.zip");
rmSync(zip, { force: true });
execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Compress-Archive -Path '${path.resolve(OUT, "TDD.pdf")}','${path.resolve(OUT, "deployment.md")}' -DestinationPath '${zip}'`,
]);

const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2);
console.log(`Diagrams rendered: ${diagrams}. Broken images: ${broken.length ? broken.join(", ") : "none"}.`);
console.log(`TDD.pdf ${mb(`${OUT}/TDD.pdf`)} MB; zip ${mb(zip)} MB -> ${zip}`);
