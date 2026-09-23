import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { NativeReportService, type ReportImageAction, type ReportImageResult, type ReportSubmitPayload } from "../services/report";

export function createNativeReportService(submit: (payload: ReportSubmitPayload) => Promise<{ id: string }>): NativeReportService {
  return new NativeReportService({
    submit,
    manipulate: (uri: string, actions: ReportImageAction[], options: { base64: true; compress: number; format: "jpeg" }): Promise<ReportImageResult> => manipulateAsync(uri, actions, { ...options, format: SaveFormat.JPEG }),
  });
}
