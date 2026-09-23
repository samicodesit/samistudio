import type { NativeLocale, NativeReportSubmission } from "../ui/types";
import { NativeServiceError } from "./errors";

export type ReportImageResult = { uri: string; width: number; height: number; base64?: string };
export type ReportImageAction = { resize: { width?: number; height?: number } };

const MAX_IMAGE_BYTES = 60_000;
const MAX_IMAGE_DIMENSION = 640;
const MAX_DETAILS_LENGTH = 500;

export interface ReportSubmitPayload {
  locale: NativeLocale;
  report: NativeReportSubmission;
  scene?: string;
  imageBase64?: string;
}

export interface NativeReportServiceOptions {
  submit(payload: ReportSubmitPayload): Promise<{ id: string }>;
  manipulate: (uri: string, actions: ReportImageAction[], options: { base64: true; compress: number; format: "jpeg" }) => Promise<ReportImageResult>;
}

export class NativeReportService {
  private readonly manipulate: NativeReportServiceOptions["manipulate"];

  constructor(private readonly options: NativeReportServiceOptions) {
    this.manipulate = options.manipulate;
  }

  async submit(input: { locale: NativeLocale; report: NativeReportSubmission; scene?: string; imageUri?: string }): Promise<{ id: string }> {
    validateReportInput(input.report);
    if (!input.report.includeContent) {
      return this.options.submit({ locale: input.locale, report: input.report, scene: undefined, imageBase64: undefined });
    }
    if (!input.scene || !input.imageUri) throw new NativeServiceError("invalid_request");
    const scene = normalizeScene(input.scene);
    const imageBase64 = await this.prepareImage(input.imageUri);
    return this.options.submit({ locale: input.locale, report: input.report, scene, imageBase64 });
  }

  private async prepareImage(uri: string): Promise<string> {
    if (!/^(?:file|content):\/\//i.test(uri)) throw new NativeServiceError("invalid_request");
    const compressions = [0.78, 0.58, 0.38, 0.22];
    for (const compress of compressions) {
      try {
        const result = await this.manipulate(uri, [{ resize: { width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION } }], { base64: true, compress, format: "jpeg" });
        if (result.base64 && base64ByteLength(result.base64) <= MAX_IMAGE_BYTES && result.width <= MAX_IMAGE_DIMENSION && result.height <= MAX_IMAGE_DIMENSION) {
          return result.base64;
        }
      } catch {
        // Try the next compression only when the native encoder can still make a valid JPEG.
      }
    }
    throw new NativeServiceError("report_unavailable");
  }
}

function validateReportInput(report: NativeReportSubmission): void {
  if (!report || typeof report.reason !== "string" || typeof report.details !== "string" || typeof report.includeContent !== "boolean") throw new NativeServiceError("invalid_request");
  if (report.details.length > MAX_DETAILS_LENGTH || (report.reason === "other" && report.details.trim().length === 0)) throw new NativeServiceError("invalid_request");
}

function normalizeScene(scene: string): string {
  const value = scene.trim();
  if (!value || Array.from(value).length > 180) throw new NativeServiceError("invalid_request");
  return value;
}

function base64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}
