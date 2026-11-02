import type { Metadata, Viewport } from "next";
import { Hind, Hind_Vadodara, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-newsreader", display: "swap" });
// Hind covers Latin + Devanagari; Hind Vadodara is the same family's Gujarati cut.
const hind = Hind({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600"], variable: "--font-hind", display: "swap" });
const hindVadodara = Hind_Vadodara({ subsets: ["latin", "gujarati"], weight: ["400", "500", "600"], variable: "--font-hind-vadodara", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Homes in Ahmedabad", template: "%s · Homes in Ahmedabad" },
  description: "Ask about Aranya Heights and Vasant Residency, and book a site visit at a time that suits you.",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#f6f4ef", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${hind.variable} ${hindVadodara.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
