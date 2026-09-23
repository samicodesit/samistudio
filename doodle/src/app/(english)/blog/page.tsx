import type { Metadata } from "next";
import { EditorialBlogPage, buildEditorialMetadata } from "@/components/editorial-pages";

export const metadata: Metadata = buildEditorialMetadata("en", "blog");

export default function BlogPage() {
  return <EditorialBlogPage locale="en" />;
}
