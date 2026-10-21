import { isDetailLevel } from "./generation/detail-level";

export function readGalleryDetail(search: string) {
  const values = new URLSearchParams(search).getAll("detail");
  return values.length === 1 && isDetailLevel(values[0]) ? values[0] : "all";
}
