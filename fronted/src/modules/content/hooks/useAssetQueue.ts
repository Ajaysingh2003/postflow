"use client";

import { useEffect, useRef, useState } from "react";
import { type SourceAsset, uploadAsset, validateSource } from "../assets";

export type QueuedAsset = {
  id: string;
  scope: string;
  file: File;
  asset?: SourceAsset;
  stage: "uploading" | "verifying" | "ready" | "failed";
  error?: string;
};

export function useAssetQueue(scope: string) {
  const [items, setItems] = useState<QueuedAsset[]>([]);
  const uploads = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const current = uploads.current;
    return () => {
      current.forEach((controller) => controller.abort());
      current.clear();
      setItems((items) => items.filter((item) => item.scope !== scope));
    };
  }, [scope]);
  const queue = items.filter((item) => item.scope === scope);
  const busy = queue.some(
    (item) => item.stage === "uploading" || item.stage === "verifying",
  );
  async function upload(item: QueuedAsset) {
    const controller = new AbortController();
    uploads.current.set(item.id, controller);
    const update = (patch: Partial<QueuedAsset>) => {
      if (!controller.signal.aborted)
        setItems((current) =>
          current.map((value) =>
            value.id === item.id ? { ...value, ...patch } : value,
          ),
        );
    };
    try {
      update({ stage: "uploading", error: undefined });
      const asset = await uploadAsset(
        item.file,
        "assistant",
        (stage) => update({ stage }),
        controller.signal,
      );
      update({ stage: "ready", asset });
    } catch (error) {
      update({
        stage: "failed",
        error: error instanceof Error ? error.message : "Upload failed. Retry.",
      });
    } finally {
      uploads.current.delete(item.id);
    }
  }
  function add(files: File[]) {
    if (!files.length) return;
    if (queue.length + files.length > 5)
      throw new Error("Attach up to 5 files per message.");
    if (
      [...queue.map((item) => item.file), ...files].reduce(
        (total, file) => total + file.size,
        0,
      ) >
      30 * 1024 * 1024
    )
      throw new Error("Keep the attached files under 30 MB in total.");
    files.forEach(validateSource);
    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      scope,
      file,
      stage: "uploading" as const,
    }));
    setItems((current) => [
      ...current.filter((item) => item.scope === scope),
      ...added,
    ]);
    added.forEach((item) => void upload(item));
  }
  function remove(id: string) {
    uploads.current.get(id)?.abort();
    setItems((current) => current.filter((item) => item.id !== id));
  }
  return {
    queue,
    busy,
    add,
    remove,
    retry: (item: QueuedAsset) => {
      if (!uploads.current.has(item.id)) void upload(item);
    },
    clear: () => {
      queue.forEach((item) => remove(item.id));
    },
    assets: queue.flatMap((item) =>
      item.asset && item.stage === "ready" ? [item.asset] : [],
    ),
  };
}
