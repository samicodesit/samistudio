"use client";
import { PaperColorSelector } from "./paper-color-selector";
import type { PaperColorId } from "@/lib/generation/paper-colors";

import { useState, type Ref } from "react";
import { DetailLevelSelector } from "./detail-level-selector";
import type { DetailLevel } from "@/lib/generation/detail-level";
import type { Locale } from "@/lib/i18n";
import { AnimatedPromptHint } from "./animated-prompt-hint";
import { MAX_SCENE_LENGTH } from "@/lib/app-config";
import type { DoodleCopy } from "@/lib/i18n";
import { ImagePlus, X } from "lucide-react";
import { getPhotoCopy } from "@/lib/photo-copy";
import type { PhotoDraft } from "./use-photo-draft";

interface SceneComposerProps {
  photo?: PhotoDraft | null;
  preparingPhoto?: boolean;
  photoError?: string | null;
  onPickPhoto?: () => void;
  onRemovePhoto?: () => void;
  locale?: Locale;
  detailLevel?: DetailLevel;
  detailReady?: boolean;
  onDetailLevelChange?: (level: DetailLevel) => void;
  paperColor?: PaperColorId;
  onPaperColorChange?: (color: PaperColorId) => void;
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
  photo,
  preparingPhoto = false,
  photoError,
  onPickPhoto,
  onRemovePhoto,
  locale = "en",
  detailLevel = "medium",
  detailReady = true,
  onDetailLevelChange,
  scene,
  isGenerating,
  onSceneChange,
  onCreate,
  copy,
  paperColor = "yellow",
  onPaperColorChange,
  createButtonRef,
  sceneInputRef,
  compactHeading = false,
  placeholderPrompts,
}: SceneComposerProps) {
  const showCounter = scene.length >= 150;
  const [focused, setFocused] = useState(false);
  const photoCopy = getPhotoCopy(locale);
  const heading = <div className="scene-heading">
    {compactHeading ? <h2 id="scene-title">{copy.title}</h2> : <h1 id="scene-title">{copy.title}</h1>}
    <div className="composer-prompt-line"><p className="scene-hint">{photo ? photoCopy.hint : copy.hint}</p>{onDetailLevelChange ? <DetailLevelSelector locale={locale} value={detailLevel} onChange={onDetailLevelChange} disabled={isGenerating || !detailReady} /> : null}</div>
  </div>;

  return (
    <section id="composer" className="composer-section" aria-labelledby="scene-title">
      <span className="composer-hero-art" aria-hidden="true" />
      {onDetailLevelChange ? null : heading}
      <div className="composer-input-wrap">
        {onDetailLevelChange ? <div className="composer-detail-row">
          {heading}
        </div> : null}
        <div className={`doodle-composer${photo ? " doodle-composer-photo" : ""}`} aria-busy={preparingPhoto}>
          {photo ? <div className="photo-selection">
            {/* Local preview has dynamic dimensions and is never sent to an image CDN. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo-preview" src={photo.uri} alt={photoCopy.alt} />
            <div className="photo-selection-actions">
              <button type="button" className="photo-action" onClick={onRemovePhoto} disabled={isGenerating || preparingPhoto}><X size={16} aria-hidden="true" />{photoCopy.remove}</button>
            </div>
          </div> : <>
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
          </>}
          <div className="composer-footer">
            <div className="composer-photo-slot">
              {onPickPhoto ? <button type="button" className="photo-action" onClick={onPickPhoto} disabled={isGenerating || preparingPhoto}><ImagePlus size={20} aria-hidden="true" />{preparingPhoto ? photoCopy.preparing : photo ? photoCopy.change : photoCopy.use}</button> : null}
              <span className="character-count" aria-live="polite">
                {!photo && showCounter ? `${scene.length} / ${MAX_SCENE_LENGTH}` : ""}
              </span>
            </div>
            <button ref={createButtonRef} type="button" onClick={onCreate} disabled={(!photo && !scene.trim()) || preparingPhoto || isGenerating || !detailReady}>
              {isGenerating ? copy.drawing : copy.create}
            </button>
          </div>
        </div>
        {photoError ? <p className="photo-error" role="alert">{photoError}</p> : null}
        <PaperColorSelector value={paperColor} onChange={onPaperColorChange ?? (() => undefined)} locale={locale} disabled={isGenerating || !detailReady || preparingPhoto} />
      </div>
    </section>
  );
}
