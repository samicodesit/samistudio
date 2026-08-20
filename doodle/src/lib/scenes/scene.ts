import { MAX_SCENE_LENGTH } from "@/lib/app-config";

export class SceneValidationError extends Error {
  constructor(readonly code: "empty" | "too_long") {
    super(
      code === "empty"
        ? "Enter a scene to draw."
        : `Keep the scene under ${MAX_SCENE_LENGTH} characters.`,
    );
    this.name = "SceneValidationError";
  }
}

export function normalizeScene(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new SceneValidationError("empty");
  }

  const scene = input.trim();
  if (scene.length > MAX_SCENE_LENGTH) {
    throw new SceneValidationError("too_long");
  }

  return scene;
}
