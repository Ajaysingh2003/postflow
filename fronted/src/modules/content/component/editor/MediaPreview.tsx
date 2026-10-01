// /* eslint-disable @next/next/no-img-element */
// "use client";
// import { useState } from "react";
// import { Loader2, RefreshCw, X } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import type { DraftAttachment } from "../../composerTypes";
// import { assetUrl } from "../../assets";
// import PdfCarousel from "./PdfCarousel";

// export default function MediaPreview({
//   asset,
//   onRemove,
// }: {
//   asset: DraftAttachment;
//   onRemove?: () => void;
// }) {
//   const [status, setStatus] = useState<"loading" | "ready" | "failed">(
//     "loading",
//   );
//   const [attempt, setAttempt] = useState(0);
//   const url = assetUrl(asset.asset_id);
//   return (
//     <div className="relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
//       {asset.content_type === "application/pdf" ? (
//         <PdfCarousel url={url} name={asset.name} />
//       ) : (
//         <>
//           {status === "loading" && (
//             <p
//               role="status"
//               className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500"
//             >
//               <Loader2 size={16} className="animate-spin" /> Loading image…
//             </p>
//           )}
//           {status === "failed" && (
//             <div role="alert" className="space-y-3 p-6 text-center text-sm">
//               <p>Could not load {asset.name}.</p>
//               <Button
//                 type="button"
//                 className="secondary-btn"
//                 variant="outline"
//                 onClick={() => {
//                   setStatus("loading");
//                   setAttempt((value) => value + 1);
//                 }}
//               >
//                 <RefreshCw size={14} /> Retry preview
//               </Button>
//             </div>
//           )}
//           <img
//             key={attempt}
//             src={`${url}?preview=${attempt}`}
//             alt={asset.name}
//             onLoad={() => setStatus("ready")}
//             onError={() => setStatus("failed")}
//             className={`max-h-96 w-full object-cover object-top ${status !== "ready" ? "hidden" : ""}`}
//           />
//         </>
//       )}
//       {onRemove && (
//         <Button
//           type="button"
//           size="icon"
//           variant="outline"
//           aria-label={`Remove ${asset.name}`}
//           onClick={onRemove}
//           className="absolute right-2 top-4 size-7 rounded-full bg-white shadow-sm"
//         >
//           <X size={14} />
//         </Button>
//       )}
//     </div>
//   );
// }

"use client";
import { useState } from "react";
import Image from "next/image";
import { Loader2, Maximize2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DraftAttachment } from "../../composerTypes";
import { assetUrl } from "../../assets";
import PdfCarousel from "./PdfCarousel";

type Status = "loading" | "ready" | "failed";

export default function MediaPreview({
  asset,
  onRemove,
}: {
  asset: DraftAttachment;
  onRemove?: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);

  const isPdf = asset.content_type === "application/pdf";
  const url = assetUrl(asset.asset_id);
  // Cache-bust only on retry so the first load can use the browser cache
  const src = attempt === 0 ? url : `${url}?retry=${attempt}`;

  const retry = () => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
      {isPdf ? (
        <PdfCarousel url={url} name={asset.name} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={status !== "ready"}
            aria-label={`Preview ${asset.name}`}
            className="group relative block  h-92 w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-default"
          >
            <Image
              key={attempt}
              src={src}
              alt={asset.name}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 640px"
              onLoad={() => setStatus("ready")}
              onError={() => setStatus("failed")}
              className={`object-contain  object-top transition-opacity duration-200 ${
                status === "ready" ? "opacity-100" : "opacity-0"
              }`}
            />
            {status === "ready" && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 size={12} /> Preview
              </span>
            )}
          </button>

          {status === "loading" && (
            <p
              role="status"
              className="absolute inset-0 flex animate-pulse items-center justify-center gap-2 bg-zinc-100 text-sm text-neutral-500"
            >
              <Loader2 size={16} className="animate-spin" /> Loading image…
            </p>
          )}

          {status === "failed" && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-50 p-6 text-center text-sm"
            >
              <p>Could not load {asset.name}.</p>
              <Button
                type="button"
                className="secondary-btn"
                variant="outline"
                onClick={retry}
              >
                <RefreshCw size={14} /> Retry preview
              </Button>
            </div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-[95vw] gap-2 !outline-none !border-none bg-transparent p-0 shadow-none sm:max-w-5xl">
              <DialogTitle className="sr-only">{asset.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Full-size preview of {asset.name}
              </DialogDescription>
              <div className="relative h-[85vh] w-full">
                <Image
                  src={src}
                  alt={asset.name}
                  fill
                  unoptimized
                  sizes="95vw"
                  className="object-contain"
                />
              </div>
              <p className="truncate text-center text-sm text-white">
                {asset.name}
              </p>
            </DialogContent>
          </Dialog>
        </>
      )}

      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`Remove ${asset.name}`}
          onClick={onRemove}
          className={`absolute right-2 size-7 rounded-full bg-white shadow-sm ${
            isPdf ? "top-12" : "top-2"
          }`}
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
