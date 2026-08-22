import { Alexandria, Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import type { Locale } from "@/lib/i18n";
import { htmlLang, textDirection } from "@/lib/i18n";
import "./globals.css";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const arabicFont = Alexandria({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={htmlLang(locale)} dir={textDirection(locale)}>
      <body className={`${displayFont.variable} ${bodyFont.variable}${locale === "ar" ? ` ${arabicFont.variable}` : ""}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
