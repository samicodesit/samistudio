import { connection } from "next/server";
import { DoodlePage } from "@/components/doodle-page";
import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import { pickSceneIdeas } from "@/lib/scenes/suggestions";

export default async function Home({ searchParams }: { searchParams: Promise<{ scene?: string | string[] }> }) {
  const scene = (await searchParams).scene;
  const initialScene = typeof scene === "string" ? scene.trim().slice(0, MAX_SCENE_LENGTH) : "";
  await connection();
  const initialSuggestionIds = pickSceneIdeas().map((idea) => idea.id);
  return <DoodlePage locale="en" initialScene={initialScene} initialSuggestionIds={initialSuggestionIds} />;
}
