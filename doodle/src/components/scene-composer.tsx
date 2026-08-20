"use client";

import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import type { DoodleCopy } from "@/lib/i18n";

interface SceneComposerProps {
  scene: string;
  isGenerating: boolean;
  onSceneChange: (scene: string) => void;
  onCreate: () => void;
  copy: DoodleCopy["composer"];
}

export function SceneComposer({ scene, isGenerating, onSceneChange, onCreate, copy }: SceneComposerProps) {
  const showCounter = scene.length >= 150;

  return (
    <section className="composer-section" aria-labelledby="scene-title">
      <h1 id="scene-title">{copy.title}</h1>
      <p className="scene-hint">{copy.hint}</p>
      <div className="doodle-composer">
        <label className="sr-only" htmlFor="scene">
          {copy.label}
        </label>
        <textarea
          id="scene"
          name="scene"
          value={scene}
          onChange={(event) => onSceneChange(event.target.value)}
          maxLength={MAX_SCENE_LENGTH}
          placeholder={copy.placeholder}
          disabled={isGenerating}
        />
        <div className="composer-footer">
          <span className="character-count" aria-live="polite">
            {showCounter ? `${scene.length} / ${MAX_SCENE_LENGTH}` : ""}
          </span>
          <button type="button" onClick={onCreate} disabled={!scene.trim() || isGenerating}>
            {isGenerating ? copy.drawing : copy.create}
          </button>
        </div>
      </div>
    </section>
  );
}
