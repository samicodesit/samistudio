export const REPORT_REASONS = ["sexual", "violence", "hate", "self-harm", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
