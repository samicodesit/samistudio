export const PAPER_CORRECTION_VERSION = "paper-v1";
export const PAPER_CORRECTION_STATUSES = ["corrected", "unchanged", "uncertain", "unsupported", "error", "disabled"] as const;
export interface PaperCorrectionMetadata {
  version: typeof PAPER_CORRECTION_VERSION;
  status: typeof PAPER_CORRECTION_STATUSES[number];
  durationMs: number;
}
