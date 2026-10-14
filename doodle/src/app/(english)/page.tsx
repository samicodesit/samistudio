import { isDetailLevel } from "@/lib/generation/detail-level";
import { connection } from "next/server";
import { DoodlePage } from "@/components/doodle-page";
import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import { pickSceneIdeas } from "@/lib/scenes/suggestions";

export default async function Home({ searchParams }: { searchParams: Promise<{ scene?: string | string[]; detail?: string | string[]; runtime?: string | string[] }> }) {
  const { scene, detail, runtime } = await searchParams;
  const initialScene = typeof scene === "string" ? scene.trim().slice(0, MAX_SCENE_LENGTH) : "";
  await connection();
  const initialSuggestionIds = pickSceneIdeas().map((idea) => idea.id);
  return <DoodlePage locale="en" initialScene={initialScene} initialDetailLevel={isDetailLevel(detail) ? detail : undefined} initialSuggestionIds={initialSuggestionIds} initialInstalled={runtime === "play" || runtime === "app"} />;
}
