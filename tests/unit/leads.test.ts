import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/leads/csv";
import { hashPhone, maskPhone, normalisePhone } from "@/lib/leads/phone";
import { nameSimilarity, normaliseName } from "@/lib/leads/similarity";

describe("normalisePhone", () => {
  it.each(["98765 43210", "+91-9876543210", "09876543210", "919876543210", "+91 (98765) 43210", " 9876543210 "])(
    "%s → +919876543210",
    (raw) => expect(normalisePhone(raw)).toBe("+919876543210"),
  );
  it.each(["", "12345", "abcdefghij", "+91 12345 67890 123"])("rejects %j", (raw) => {
    expect(normalisePhone(raw)).toBeNull();
  });
  it("hashes equal numbers equally and masks to last 4", () => {
    expect(hashPhone(normalisePhone("09876543210")!)).toBe(hashPhone(normalisePhone("98765 43210")!));
    expect(maskPhone("+919876543210")).toBe("••••• •3210");
  });
});

describe("nameSimilarity", () => {
  it("treats order, case, punctuation and honorifics as the same name", () => {
    expect(normaliseName("Mr. Hardik  PATEL")).toBe("hardik patel");
    expect(nameSimilarity("Patel Hardik", "hardik patel")).toBe(1);
  });
  it("scores small typos high and different people low", () => {
    expect(nameSimilarity("Nidhi Shah", "Nidhi Shaah")).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity("Nidhi Shah", "Kavita Joshi")).toBeLessThan(0.5);
  });
});

describe("parseCsv", () => {
  it("handles quotes, commas in fields, escaped quotes, CRLF and BOM", () => {
    const rows = parseCsv('﻿name,note\r\n"Shah, Nidhi","said ""hi"""\r\nA,B\n\n');
    expect(rows).toEqual([
      ["name", "note"],
      ["Shah, Nidhi", 'said "hi"'],
      ["A", "B"],
    ]);
  });
});
