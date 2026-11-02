function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Minimal RFC 5545 calendar file for one site visit. */
export function visitIcs(v: { id: string; startsAt: Date; endsAt: Date; projectName: string; address: string; mapUrl: string; reraNumber: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Company A//Site visit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:visit-${v.id}@companya.test`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(v.startsAt)}`,
    `DTEND:${stamp(v.endsAt)}`,
    `SUMMARY:${esc(`Site visit: ${v.projectName}`)}`,
    `LOCATION:${esc(v.address)}`,
    `DESCRIPTION:${esc(`Map: ${v.mapUrl}\nRERA No. ${v.reraNumber}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
