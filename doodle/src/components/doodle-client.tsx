"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UnlockForm } from "./unlock-form";
import { SceneComposer } from "./scene-composer";
import { DoodleStage } from "./doodle-stage";
import { ResultActions } from "./result-actions";

type GenerationState =
  | { status: "idle"; imageUrl: null; error: null }
  | { status: "generating"; imageUrl: null; error: null }
  | { status: "ready"; imageUrl: string; error: null }
  | { status: "error"; imageUrl: null; error: string };

interface DoodleClientProps {
  initialAuthenticated: boolean;
  suggestions: readonly [string, string, string];
}

const IDLE_STATE: GenerationState = { status: "idle", imageUrl: null, error: null };

function messageForStatus(status: number): string {
  if (status === 422) return "That scene could not be drawn. Try describing it differently.";
  if (status === 504) return "The doodle took too long. Please try again.";
  return "Doodle could not finish that image. Please try again.";
}

export function DoodleClient({ initialAuthenticated, suggestions }: DoodleClientProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [scene, setScene] = useState("");
  const [generation, setGeneration] = useState<GenerationState>(IDLE_STATE);
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
    if (!authenticated || !scene.trim() || generation.status === "generating") return;

    revokeCurrentUrl();
    setGeneration({ status: "generating", imageUrl: null, error: null });
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setGeneration(IDLE_STATE);
        return;
      }
      if (!response.ok) {
        setGeneration({ status: "error", imageUrl: null, error: messageForStatus(response.status) });
        return;
      }

      const imageUrl = URL.createObjectURL(await response.blob());
      currentObjectUrl.current = imageUrl;
      setGeneration({ status: "ready", imageUrl, error: null });
    } catch {
      setGeneration({
        status: "error",
        imageUrl: null,
        error: "Doodle could not finish that image. Please try again.",
      });
    }
  }

  function handleUnlocked() {
    setAuthenticated(true);
    clearGeneration();
  }

  function handleNewScene() {
    setScene("");
    clearGeneration();
  }

  function handleSuggestion(sceneSuggestion: string) {
    setScene(sceneSuggestion);
    clearGeneration();
  }

  if (!authenticated) {
    return <UnlockForm onUnlocked={handleUnlocked} />;
  }

  return (
    <div className="doodle-workspace">
      <DoodleStage status={generation.status} imageUrl={generation.imageUrl} error={generation.error} />
      <SceneComposer
        scene={scene}
        isGenerating={generation.status === "generating"}
        onSceneChange={setScene}
        onCreate={createDoodle}
      />
      {generation.status === "ready" && generation.imageUrl ? (
        <ResultActions imageUrl={generation.imageUrl} onTryAgain={createDoodle} onNewScene={handleNewScene} />
      ) : null}
      {generation.status !== "generating" && generation.status !== "ready" ? (
        <section className="suggestions-section" aria-labelledby="suggestions-title">
          <div className="suggestions-heading">
            <h2 id="suggestions-title">Or try one</h2>
          </div>
          <div className="suggestions-list">
            {suggestions.map((suggestion) => (
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
  );
}
