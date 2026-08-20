"use client";

import { Download, Plus, RotateCcw } from "lucide-react";

interface ResultActionsProps {
  imageUrl: string;
  onTryAgain: () => void;
  onNewScene: () => void;
}

export function ResultActions({ imageUrl, onTryAgain, onNewScene }: ResultActionsProps) {
  return (
    <div className="result-actions">
      <a className="primary-action" href={imageUrl} download="doodle.png">
        <Download size={16} aria-hidden="true" />
        Download
      </a>
      <div className="secondary-actions">
        <button type="button" onClick={onTryAgain}>
          <RotateCcw size={15} aria-hidden="true" />
          Try again
        </button>
        <button type="button" onClick={onNewScene}>
          <Plus size={16} aria-hidden="true" />
          New scene
        </button>
      </div>
    </div>
  );
}
