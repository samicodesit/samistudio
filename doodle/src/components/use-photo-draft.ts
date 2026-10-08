"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTO_BYTES, PHOTO_MAX_EDGE } from "@/lib/generation/photo-input";
import { photoDraftStore } from "@/lib/photo-draft-store";
import type { PhotoCopy } from "@/lib/photo-copy";

export interface PhotoDraft { base64: string; uri: string }

async function preparePhoto(file: File): Promise<PhotoDraft> {
  if (file.size > 20_000_000) throw new Error("tooLarge");
  if (!file.type.startsWith("image/") || !file.size) throw new Error("invalid");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24_000_000) throw new Error("tooLarge");
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = uri.split(",")[1];
    if (base64.length * 0.75 > MAX_PHOTO_BYTES) throw new Error("tooLarge");
    return { base64, uri };
  } finally { bitmap.close(); }
}

export function usePhotoDraft(scene: string, onRestoreScene: (scene: string) => void, copy: PhotoCopy) {
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const revision = useRef(0);
  const write = useRef<Promise<unknown>>(Promise.resolve());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    try {
      const id = sessionStorage.getItem("doodle:photo-draft-id") ?? crypto.randomUUID();
      sessionStorage.setItem("doodle:photo-draft-id", id);
      key.current = id;
      const version = revision.current;
      void photoDraftStore("read", id).then(saved => {
        if (active && version === revision.current && saved) {
          setPhoto({ base64: saved.base64, uri: `data:image/jpeg;base64,${saved.base64}` });
          onRestoreScene(saved.scene);
        }
      }).catch(() => {});
    } catch { /* A blocked local store does not prevent in-memory photo use. */ }
    return () => {
      active = false; revision.current += 1;
      const id = key.current;
      // A selected Idea starts a new draft. Remove any old queued write after it settles.
      void write.current.catch(() => {}).then(async () => {
        try { if (id && sessionStorage.getItem("doodle:photo-draft-id") !== id) await photoDraftStore("remove", id); } catch {}
      });
    };
  }, [onRestoreScene]);

  useEffect(() => {
    if (!photo || !key.current) return;
    const id = key.current;
    write.current = write.current.catch(() => {}).then(() => photoDraftStore("write", id, { base64: photo.base64, scene })).catch(() => {});
  }, [photo, scene]);

  async function select(file: File | undefined) {
    if (!file) return;
    const version = ++revision.current;
    setPreparing(true); setError(null);
    try {
      const selected = await preparePhoto(file);
      if (version === revision.current) setPhoto(selected);
    } catch (failure) {
      if (version === revision.current) setError(failure instanceof Error && failure.message === "tooLarge" ? copy.tooLarge : copy.invalid);
    } finally {
      if (version === revision.current) setPreparing(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    revision.current += 1;
    setPhoto(null); setPreparing(false); setError(null);
    if (key.current) {
      const id = key.current;
      write.current = write.current.catch(() => {}).then(() => photoDraftStore("remove", id)).catch(() => {});
    }
  }
  return { photo, preparing, error, input, select, remove, pick: () => input.current?.click() };
}
