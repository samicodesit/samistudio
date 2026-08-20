import type { Metadata } from "next";
import { RootDocument } from "../root-document";
import { buildPageMetadata } from "@/lib/i18n";

export const metadata: Metadata = buildPageMetadata("en");

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
