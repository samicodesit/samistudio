"use client";

import { MAX_SCENE_LENGTH } from "@/lib/app-config";

interface SceneComposerProps {
  scene: string;
  isGenerating: boolean;
  onSceneChange: (scene: string) => void;
  onCreate: () => void;
}

export function SceneComposer({ scene, isGenerating, onSceneChange, onCreate }: SceneComposerProps) {
  const showCounter = scene.length >= 150;

  return (
    <section className="composer-section" aria-labelledby="scene-title">
      <h1 id="scene-title">What should we doodle?</h1>
      <p className="scene-hint">Keep it small and clear.</p>
      <div className="doodle-composer">
        <label className="sr-only" htmlFor="scene">
          Describe a scene
        </label>
        <textarea
          id="scene"
          name="scene"
          value={scene}
          onChange={(event) => onSceneChange(event.target.value)}
          maxLength={MAX_SCENE_LENGTH}
          placeholder="A small moment..."
          disabled={isGenerating}
        />
        <div className="composer-footer">
          <span className="character-count" aria-live="polite">
            {showCounter ? `${scene.length} / ${MAX_SCENE_LENGTH}` : ""}
          </span>
          <button type="button" onClick={onCreate} disabled={!scene.trim() || isGenerating}>
            {isGenerating ? "Drawing..." : "Create doodle"}
          </button>
        </div>
      </div>
    </section>
  );
}
