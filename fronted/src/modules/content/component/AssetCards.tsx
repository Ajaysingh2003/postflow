/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  Film,
  Headphones,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetUrl, fileType, formatSize, type SourceAsset } from "../assets";
import type { QueuedAsset } from "../hooks/useAssetQueue";

function FileThumb({ file, asset }: { file?: File; asset?: SourceAsset }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file || !fileType(file).startsWith("image/") || !image.current) return;
    const url = URL.createObjectURL(file);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [failed, setFailed] = useState(false);
  const type = asset?.content_type ?? (file ? fileType(file) : "");
  if (type.startsWith("image/") && !failed)
    return (
      <img
        ref={image}
        src={!file && asset ? assetUrl(asset.asset_id) : undefined}
        alt=""
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    );
  const Icon = type.startsWith("video/")
    ? Film
    : type.startsWith("audio/")
      ? Headphones
      : FileText;
  return <Icon className="size-5 text-sky-600" />;
}

export function AssetCards({ assets }: { assets: SourceAsset[] }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {assets.map((asset) => (
        <a
          key={asset.asset_id}
          href={assetUrl(asset.asset_id)}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2 rounded-xl border bg-white p-2 text-left transition hover:bg-sky-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sky-50">
            <FileThumb asset={asset} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">
              {asset.name}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-neutral-500">
              <Check size={12} className="text-emerald-600" /> Sent ·{" "}
              {formatSize(asset.size)}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}

export function PendingAssetCards({
  items,
  onRemove,
  onRetry,
}: {
  items: QueuedAsset[];
  onRemove: (id: string) => void;
  onRetry: (item: QueuedAsset) => void;
}) {
  return (
    <div className="mb-3 space-y-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border p-2 ${item.stage === "failed" ? "border-red-200 bg-red-50" : "border-sky-100 bg-sky-50/50"}`}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              <FileThumb file={item.file} asset={item.asset} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{item.file.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
                {item.stage === "ready" ? (
                  <Check size={12} className="text-emerald-600" />
                ) : item.stage !== "failed" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                {item.stage === "ready"
                  ? "Ready to send"
                  : item.stage === "uploading"
                    ? "Uploading…"
                    : item.stage === "verifying"
                      ? "Checking file…"
                      : "Upload failed"}{" "}
                · {formatSize(item.file.size)}
              </p>
            </div>
            {item.stage === "failed" && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onRetry(item)}
                aria-label={`Retry ${item.file.name}`}
              >
                <RefreshCw size={14} />
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.file.name}`}
            >
              <X size={14} />
            </Button>
          </div>
          {item.error && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {item.error}
            </p>
          )}
        </div>
      ))}
      <p className="text-[11px] text-neutral-500">
        Reference files for writing. They won’t be added to your post.
      </p>
    </div>
  );
}
