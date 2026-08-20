"use client";

/* eslint-disable @next/next/no-img-element -- generated images are browser-owned object URLs. */
import Image from "next/image";

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
      <Image
        src="/references/doodle-reference-kiss.png"
        alt="Simple sticky-note doodle of two cats kissing upside down"
        width={1024}
        height={1024}
        priority
      />
    </div>
  );
}
