"use client";

type StageStatus = "idle" | "generating" | "ready" | "error";

interface DoodleStageProps {
  status: StageStatus;
  imageUrl: string | null;
  error: string | null;
}

export function DoodleStage({ status, imageUrl, error }: DoodleStageProps) {
  if (status === "generating") {
    return (
      <div className="doodle-stage doodle-stage-loading" role="status" aria-live="polite">
        <span className="loading-mark" aria-hidden="true" />
        <span>Drawing your doodle...</span>
      </div>
    );
  }

  if (status === "ready" && imageUrl) {
    return (
      <div className="doodle-stage doodle-stage-result">
        <img src={imageUrl} alt="Generated sticky-note doodle" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="doodle-stage doodle-stage-error" role="alert">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="doodle-stage doodle-stage-reference">
      <img src="/references/doodle-reference-kiss.png" alt="Simple sticky-note doodle of two cats kissing upside down" />
    </div>
  );
}
