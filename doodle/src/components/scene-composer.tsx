"use client";

import { useState, type Ref } from "react";
import { AnimatedPromptHint } from "./animated-prompt-hint";
import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import type { DoodleCopy } from "@/lib/i18n";

interface SceneComposerProps {
  scene: string;
  isGenerating: boolean;
  onSceneChange: (scene: string) => void;
  onCreate: () => void;
  copy: DoodleCopy["composer"];
  usage: string | null;
  usageLoadingLabel: string;
  createButtonRef?: Ref<HTMLButtonElement>;
  sceneInputRef?: Ref<HTMLTextAreaElement>;
  compactHeading?: boolean;
  placeholderPrompts?: readonly string[];
}

export function SceneComposer({
  scene,
  isGenerating,
  onSceneChange,
  onCreate,
  copy,
  usage,
  usageLoadingLabel,
  createButtonRef,
  sceneInputRef,
  compactHeading = false,
  placeholderPrompts,
}: SceneComposerProps) {
  const showCounter = scene.length >= 150;
  const [focused, setFocused] = useState(false);

  return (
    <section id="composer" className="composer-section" aria-labelledby="scene-title">
      {compactHeading ? <h2 id="scene-title">{copy.title}</h2> : <h1 id="scene-title">{copy.title}</h1>}
      {compactHeading ? null : <p className="scene-hint">{copy.hint}</p>}
      <div className="doodle-composer">
        <label className="sr-only" htmlFor="scene">
          {copy.label}
        </label>
        <textarea
          ref={sceneInputRef}
          id="scene"
          name="scene"
          value={scene}
          onChange={(event) => onSceneChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={MAX_SCENE_LENGTH}
          placeholder={copy.placeholder}
          disabled={isGenerating}
        />
        {placeholderPrompts?.length && !scene && !focused && !isGenerating ? <AnimatedPromptHint prompts={placeholderPrompts} /> : null}
        <div className="composer-footer">
          <div className="composer-meta">
            {usage === null
              ? <span className="usage-loading" role="status" aria-label={usageLoadingLabel} />
              : <span className="usage-copy" aria-live="polite">{usage}</span>}
            <span className="character-count" aria-live="polite">
              {showCounter ? `${scene.length} / ${MAX_SCENE_LENGTH}` : ""}
            </span>
          </div>
          <button ref={createButtonRef} type="button" onClick={onCreate} disabled={!scene.trim() || isGenerating}>
            {isGenerating ? copy.drawing : copy.create}
          </button>
        </div>
      </div>
    </section>
  );
}
