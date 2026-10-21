import { requireNativeModule } from "expo";

export interface PreparedNativePhoto { uri: string; base64: string }

export function prepareAndroidPhoto(uri: string, sourceBytes: number, sourcePixels: number, edge: number, outputBytes: number): Promise<PreparedNativePhoto> {
  return requireNativeModule<{ prepare: (uri: string, sourceBytes: number, sourcePixels: number, edge: number, outputBytes: number) => Promise<PreparedNativePhoto> }>("DoodlePhoto").prepare(uri, sourceBytes, sourcePixels, edge, outputBytes);
}

export function prepareIosPhoto(uri: string, sourceBytes: number, sourcePixels: number, edge: number, outputBytes: number): Promise<PreparedNativePhoto> {
  return requireNativeModule<{ prepare: (uri: string, sourceBytes: number, sourcePixels: number, edge: number, outputBytes: number) => Promise<PreparedNativePhoto> }>("DoodlePhoto").prepare(uri, sourceBytes, sourcePixels, edge, outputBytes);
}
