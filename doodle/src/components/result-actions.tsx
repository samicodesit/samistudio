"use client";

import { Download, Plus, RotateCcw } from "lucide-react";
import type { DoodleCopy } from "@/lib/i18n";

interface ResultActionsProps {
  imageUrl: string;
  onTryAgain: () => void;
  onNewScene: () => void;
  copy: DoodleCopy["actions"];
}

export function ResultActions({ imageUrl, onTryAgain, onNewScene, copy }: ResultActionsProps) {
  return (
    <div className="result-actions">
      <a className="primary-action" href={imageUrl} download="doodle.png">
        <Download size={16} aria-hidden="true" />
        {copy.download}
      </a>
      <div className="secondary-actions">
        <button type="button" onClick={onTryAgain}>
          <RotateCcw size={15} aria-hidden="true" />
          {copy.tryAgain}
        </button>
        <button type="button" onClick={onNewScene}>
          <Plus size={16} aria-hidden="true" />
          {copy.newScene}
        </button>
      </div>
    </div>
  );
}
