import type { Metadata } from "next";
import { ForAiPage, buildEditorialMetadata } from "@/components/editorial-pages";

export const metadata: Metadata = buildEditorialMetadata("en", "for-ai");

export default function EnglishForAiPage() {
  return <ForAiPage locale="en" />;
}
