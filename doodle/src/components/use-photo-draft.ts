"use client";
import { useEffect, useRef, useState } from "react";
import { preparePhoto } from "@/lib/prepare-photo";
import { photoDraftStore } from "@/lib/photo-draft-store";
import type { PhotoCopy } from "@/lib/photo-copy";

export interface PhotoDraft { base64: string; uri: string }


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
    if (!file) return false;
    const version = ++revision.current;
    setPreparing(true); setError(null);
    try {
      const selected = await preparePhoto(file);
      if (version !== revision.current) return false;
      setPhoto(selected);
      return true;
    } catch (failure) {
      if (version === revision.current) setError(failure instanceof Error && failure.message === "tooLarge" ? copy.tooLarge : copy.invalid);
      return false;
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
