"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PDFDocumentProxy } from "pdfjs-dist";

export default function PdfCarousel({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string>();
  const [rendering, setRendering] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let task:
      ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    void import("pdfjs-dist")
      .then((pdf) => {
        if (cancelled) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdf.getDocument({ url });
        task.onPassword = () => {
          if (!cancelled)
            setError(
              "This PDF is password protected. Upload an unlocked copy.",
            );
          void task?.destroy();
        };
        return task.promise;
      })
      .then((doc) => {
        if (doc && !cancelled) setDocument(doc);
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not open this PDF. Retry or upload a new copy.");
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, attempt]);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let task: import("pdfjs-dist").RenderTask | undefined;
    void document
      .getPage(page)
      .then((pdfPage) => {
        const element = canvas.current;
        if (cancelled || !element) return;
        const width = Math.min(element.parentElement?.clientWidth ?? 640, 900);
        const scale = width / pdfPage.getViewport({ scale: 1 }).width;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        element.width = viewport.width;
        element.height = viewport.height;
        task = pdfPage.render({ canvas: element, viewport });
        return task.promise;
      })
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "RenderingCancelledException")
          setError("Could not display this PDF page. Please retry.");
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, page]);
  return (
    <div>
      <div className="flex items-center gap-2 border-b p-3">
        <span className="min-w-0 flex-1 truncate text-sm font-subheading">
          {name}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${name}`}
          className="text-neutral-500"
        >
          <ExternalLink size={16} />
        </a>
      </div>
      {error ? (
        <div role="alert" className="space-y-3 p-6 text-center text-sm">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            className="secondary-btn"
            onClick={() => {
              setError(undefined);
              setDocument(undefined);
              setPage(1);
              setRendering(true);
              setAttempt((value) => value + 1);
            }}
          >
            <RefreshCw size={14} /> Retry preview
          </Button>
        </div>
      ) : (
        <div className="relative min-h-44 bg-neutral-100">
          <canvas
            ref={canvas}
            aria-label={`${name}, page ${page}`}
            className={`mx-auto max-h-[540px] max-w-full ${rendering ? "invisible" : ""}`}
          />
          {rendering && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-500"
            >
              <Loader2 size={16} className="animate-spin" /> Loading page…
            </div>
          )}
        </div>
      )}
      {document && !error && (
        <div className="flex items-center justify-center gap-4 border-t p-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="secondary-btn"
            disabled={page <= 1 || rendering}
            onClick={() => {
              setRendering(true);
              setPage((value) => value - 1);
            }}
            aria-label="Previous PDF page"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs tabular-nums">
            {page} / {document.numPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="secondary-btn"
            disabled={page >= document.numPages || rendering}
            onClick={() => {
              setRendering(true);
              setPage((value) => value + 1);
            }}
            aria-label="Next PDF page"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
