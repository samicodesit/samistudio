"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SceneComposer } from "./scene-composer";
import { DoodleStage } from "./doodle-stage";
import { ResultActions } from "./result-actions";
import { ResultDialog } from "./result-dialog";
import type { DoodleCopy } from "@/lib/i18n";

type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; error: null }
  | { status: "error"; imageUrl: null; error: string };

interface DoodleClientProps {
  copy: DoodleCopy;
}

const IDLE_STATE: GenerationState = { status: "idle", imageUrl: null, error: null };

function messageForStatus(status: number, copy: DoodleCopy["errors"]): string {
  if (status === 401) return copy.unavailable;
  if (status === 422) return copy.refused;
  if (status === 504) return copy.timeout;
  return copy.general;
}

export function DoodleClient({ copy }: DoodleClientProps) {
  const [scene, setScene] = useState("");
  const [generation, setGeneration] = useState<GenerationState>(IDLE_STATE);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const currentObjectUrl = useRef<string | null>(null);

  const revokeCurrentUrl = useCallback(() => {
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current);
      currentObjectUrl.current = null;
    }
  }, []);

  const clearGeneration = useCallback(() => {
    revokeCurrentUrl();
    setGeneration(IDLE_STATE);
  }, [revokeCurrentUrl]);

  useEffect(() => revokeCurrentUrl, [revokeCurrentUrl]);

  async function createDoodle() {
    if (!scene.trim() || generation.status === "generating") return;

    revokeCurrentUrl();
    setGeneration({ status: "generating", imageUrl: null, error: null });
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });

      if (!response.ok) {
        setGeneration({ status: "error", imageUrl: null, error: messageForStatus(response.status, copy.errors) });
        return;
      }

      const imageUrl = URL.createObjectURL(await response.blob());
      currentObjectUrl.current = imageUrl;
      setGeneration({ status: "ready", imageUrl, error: null });
    } catch {
      setGeneration({
        status: "error",
        imageUrl: null,
        error: copy.errors.general,
      });
    }
  }

  function handleNewScene() {
    setScene("");
    setIsResultOpen(false);
    clearGeneration();
  }

  function handleSuggestion(sceneSuggestion: string) {
    setScene(sceneSuggestion);
    setIsResultOpen(false);
    clearGeneration();
  }

  const inspectedImageUrl =
    generation.status === "ready" && generation.imageUrl
      ? generation.imageUrl
      : "/references/doodle-reference-kiss.png";

  return (
    <div className={`doodle-workspace doodle-workspace-${generation.status}`}>
      <div className="workspace-copy">
        {generation.status === "generating" ? (
          <section className="state-copy" aria-labelledby="generating-title">
            <p className="eyebrow">{copy.status.generatingEyebrow}</p>
            <h1 id="generating-title">{copy.status.generatingTitle}</h1>
            <p className="scene-summary">“{scene}”</p>
            <p className="wait-hint">{copy.status.waitHint}</p>
          </section>
        ) : generation.status === "ready" ? (
          <section className="state-copy" aria-labelledby="ready-title">
            <p className="eyebrow">{copy.status.readyEyebrow}</p>
            <h1 id="ready-title">{copy.status.readyTitle}</h1>
            <p className="scene-summary">“{scene}”</p>
            <ResultActions imageUrl={generation.imageUrl} onTryAgain={createDoodle} onNewScene={handleNewScene} copy={copy.actions} />
          </section>
        ) : (
          <SceneComposer
            scene={scene}
            isGenerating={false}
            onSceneChange={setScene}
            onCreate={createDoodle}
            copy={copy.composer}
          />
        )}
        {generation.status !== "generating" && generation.status !== "ready" ? (
        <section className="suggestions-section" aria-labelledby="suggestions-title">
          <div className="suggestions-heading">
            <h2 id="suggestions-title">{copy.suggestions.title}</h2>
          </div>
          <div className="suggestions-list">
            {copy.suggestions.items.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => handleSuggestion(suggestion)}>
                <span>{suggestion}</span>
                <span className="suggestion-plus" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
          </div>
        </section>
        ) : null}
      </div>
      <div className="workspace-visual">
        <DoodleStage
          key={generation.status}
          status={generation.status}
          imageUrl={generation.imageUrl}
          error={generation.error}
          onInspect={() => setIsResultOpen(true)}
          copy={copy.stage}
        />
      </div>
      {isResultOpen ? (
        <ResultDialog
          key={isResultOpen ? "open" : "closed"}
          imageUrl={inspectedImageUrl}
          open={isResultOpen}
          onClose={() => setIsResultOpen(false)}
          copy={copy.dialog}
        />
      ) : null}
    </div>
  );
}
