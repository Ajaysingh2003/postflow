"use client";

/* Workspace images use the authenticated same-origin media proxy. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Check, X, FileText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";
import type { Payload } from "@/modules/studio/types";

import { cn } from "@/lib/utils";
import { uploadAsset, validatePostAsset } from "../assets";

export function MediaPreview({
  assets,
  ids,
  readOnly,
  onRemove,
}: {
  assets: Payload[];
  ids: string[];
  readOnly: boolean;
  onRemove: (id: string) => void;
}) {
  return ids.length ? (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 my-3 mb-5">
      {ids.map((id) => {
        const asset = assets.find((item) => item.id === id);
        const type = String(asset?.content_type ?? "");
        return (
          <figure
            key={id}
            className="relative rounded-xl overflow-hidden border border-border bg-muted"
          >
            {type.startsWith("image/") ? (
              <img
                className="w-full max-h-[330px] object-cover"
                src={`/api/media/${id}/content`}
                alt={String(
                  asset?.alt_text ??
                    asset?.original_filename ??
                    "Attached image",
                )}
              />
            ) : type.startsWith("video/") ? (
              <video
                className="w-full max-h-[330px] object-cover"
                src={`/api/media/${id}/content`}
                controls
                aria-label={String(
                  asset?.original_filename ?? "Attached video",
                )}
              />
            ) : (
              <a
                className="flex flex-col items-center gap-2.5 p-7.5 text-[11px] text-foreground hover:underline"
                href={`/api/media/${id}/content`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={24} />
                {String(asset?.original_filename ?? "View attachment")}
              </a>
            )}
            {!readOnly && (
              <button
                className="absolute right-2 top-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full cursor-pointer transition-colors"
                aria-label={`Remove ${String(asset?.original_filename ?? "attachment")}`}
                onClick={() => onRemove(id)}
              >
                <X size={14} />
              </button>
            )}
          </figure>
        );
      })}
    </div>
  ) : null;
}

export default function MediaPicker({
  open,
  onClose,
  assets,
  ids,
  capabilities,
  onChange,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  assets: Payload[];
  ids: string[];
  capabilities: Payload;
  platform: string;
  onChange: (ids: string[]) => void;
  onRefresh: () => void;
}) {
  const trpc = useTRPC();
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadError, setUploadError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) controller.current?.abort();
  }, [open]);
  const [altAsset, setAltAsset] = useState<Payload | null>(null);
  const [altText, setAltText] = useState("");
  const update = useMutation(
    trpc.studio.updateMedia.mutationOptions({
      onSuccess: () => {
        setAltAsset(null);
        onRefresh();
        toast.success(
          "Alt text saved. Save the draft to update its attachments.",
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const supported = Array.isArray(capabilities.supported_media_types)
    ? (capabilities.supported_media_types as string[])
    : [];
  async function upload(files: File[]) {
    if (controller.current) return;
    const maximum = Number(capabilities.max_media_count ?? 4);
    if (files.length + ids.length > maximum) {
      setUploadError(`Choose up to ${Math.max(0, maximum - ids.length)} more attachments.`);
      return;
    }
    try {
      files.forEach((file) => validatePostAsset(file, supported));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Choose a supported file.");
      return;
    }
    const operation = new AbortController();
    controller.current = operation;
    setUploading(true);
    setUploadError("");
    let chosen = [...ids];
    try {
      for (const file of files) {
        const asset = await uploadAsset(
          file,
          "post",
          (stage) => setUploadLabel(
            `${stage === "uploading" ? "Uploading" : "Checking"} ${file.name}…`,
          ),
          operation.signal,
        );
        if (operation.signal.aborted) return;
        chosen = [...new Set([...chosen, asset.asset_id])];
        onChange(chosen);
        onRefresh();
      }
      toast.success(files.length === 1 ? "File uploaded and attached" : "Files uploaded and attached");
    } catch (error) {
      if (!operation.signal.aborted) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setUploadError(message);
        toast.error(message);
      }
    } finally {
      setUploading(false);
      setUploadLabel("");
      controller.current = null;
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) {
        controller.current?.abort();
        setUploading(false);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-2xl p-6 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add media</DialogTitle>
          <DialogDescription>
            Choose files for this post, or upload new photos and videos.{" "}
            Up to {Number(capabilities.max_media_count ?? 4)} attachments.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 my-4">
          <label className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3.5 py-2 border border-border bg-background hover:bg-muted text-foreground cursor-pointer whitespace-nowrap transition-colors">
            <ImagePlus size={15} />
            {uploading ? "Uploading…" : "Upload a file"}
            <input
              type="file"
              className="sr-only"
              accept={supported.join(",")}
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void upload(files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3.5 py-2 border border-border bg-background hover:bg-muted text-foreground cursor-pointer whitespace-nowrap transition-colors"
            onClick={onRefresh}
          >
            <RefreshCw size={14} />
            Refresh library
          </button>
        </div>
        {uploading && <p role="status" className="text-xs text-muted-foreground">{uploadLabel || "Preparing upload…"}</p>}
        {uploadError && <p role="alert" className="text-xs text-destructive">{uploadError}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
          {assets
            .filter(
              (asset) =>
                !supported.length ||
                supported.includes(String(asset.content_type)),
            )
            .map((asset) => {
              const id = String(asset.id);
              const selected = ids.includes(id);
              return (
                <article
                  key={id}
                  className="border border-border rounded-lg overflow-hidden flex flex-col"
                >
                  <button
                    aria-label={`Attach ${String(asset.original_filename)}`}
                    aria-pressed={selected}
                    disabled={
                      uploading || asset.status !== "ready" ||
                      (!selected &&
                        ids.length >= Number(capabilities.max_media_count ?? 4))
                    }
                    className={cn(
                      "w-full flex items-center flex-col gap-2 p-2.5 text-[11px] text-left cursor-pointer transition-colors",
                      selected ? "bg-[#239a7d]/10 text-[#239a7d]" : "hover:bg-muted",
                    )}
                    onClick={() =>
                      onChange(
                        selected
                          ? ids.filter((value) => value !== id)
                          : [...ids, id],
                      )
                    }
                  >
                    {asset.status === "ready" &&
                    String(asset.content_type).startsWith("image/") ? (
                      <img
                        className="h-[85px] w-full object-cover rounded"
                        src={`/api/media/${id}/content`}
                        alt={String(asset.alt_text ?? asset.original_filename)}
                      />
                    ) : (
                      <FileText size={28} />
                    )}
                    <span className="truncate max-w-full text-xs font-medium">
                      {String(asset.original_filename)}
                    </span>
                    {selected && <Check size={16} />}
                    <small className="text-[9px] text-muted-foreground uppercase tracking-wider">
                      {String(asset.status)}
                    </small>
                  </button>
                  {capabilities.supports_alt_text === true &&
                    asset.status === "ready" && (
                      <button
                        className="text-[10px] w-full p-2 border-t border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer text-center"
                        onClick={() => {
                          setAltAsset(asset);
                          setAltText(String(asset.alt_text ?? ""));
                        }}
                      >
                        Edit alt text
                      </button>
                    )}
                </article>
              );
            })}
        </div>
        {!assets.length && (
          <p className="text-[11px] text-muted-foreground text-center py-6 leading-relaxed">
            Your media library is empty. Upload a file to get started.
          </p>
        )}
        {altAsset && (
          <section className="p-3 border border-border rounded-lg my-4 space-y-2.5 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-medium [&_textarea]:border [&_textarea]:border-border [&_textarea]:rounded-md [&_textarea]:p-2 [&_textarea]:text-xs [&_textarea]:bg-background [&_textarea]:outline-none [&_textarea]:focus-visible:ring-1 [&_textarea]:focus-visible:ring-ring">
            <label>
              Alt text for {String(altAsset.original_filename)}
              <textarea
                rows={3}
                maxLength={1000}
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            </label>
            <button
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3.5 py-2 border border-border bg-background hover:bg-muted text-foreground cursor-pointer whitespace-nowrap transition-colors disabled:opacity-40"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: String(altAsset.id), alt_text: altText })
              }
            >
              Save alt text
            </button>
          </section>
        )}
        <button
          className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md px-3.5 py-2.5 bg-[#239a7d] hover:bg-[#198268] text-white cursor-pointer whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full mt-3"
          disabled={uploading}
          onClick={onClose}
        >
          Done · {ids.length} attached
        </button>
      </DialogContent>
    </Dialog>
  );
}
