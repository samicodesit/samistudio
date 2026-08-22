import { DoodleIdeasPage } from "@/components/doodle-ideas-page";
import { buildDoodleIdeasMetadata } from "@/lib/doodle-ideas";

export const metadata = buildDoodleIdeasMetadata("en");

export default function DoodleIdeasRoute() {
  return <DoodleIdeasPage locale="en" />;
}
