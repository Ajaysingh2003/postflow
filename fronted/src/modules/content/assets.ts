export type SourceAsset = {
  asset_id: string;
  name: string;
  content_type: string;
  size: number;
};

const EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const SOURCE_ACCEPT = Object.keys(EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");
export function fileType(file: File) {
  // Safari may omit MIME types for PDFs and Office documents.
  return (
    EXTENSIONS[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type
  );
}
export function validateSource(file: File) {
  if (!Object.values(EXTENSIONS).includes(fileType(file)))
    throw new Error(
      `${file.name}: choose an image, PDF, Office document, text, MP4, MP3, or WAV file.`,
    );
  if (!file.size) throw new Error(`${file.name} is empty.`);
  if (file.size > 20 * 1024 * 1024)
    throw new Error(`${file.name} exceeds 20 MB.`);
}
export function assetUrl(id: string) {
  return `/api/media/${encodeURIComponent(id)}/content`;
}
export function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export async function uploadAsset(
  file: File,
  purpose: "assistant" | "post",
  onStage?: (stage: "uploading" | "scanning") => void,
  signal?: AbortSignal,
): Promise<SourceAsset> {
  const body = new FormData();
  body.append("file", file);
  body.append("content_type", fileType(file));
  body.append("purpose", purpose);
  onStage?.("uploading");
  // Upload progress is distinct from the server's verification step.
  const data = await new Promise<{
    id: string;
    original_filename: string;
    content_type: string;
    actual_size: number;
    status: string;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.open("POST", "/api/media/attachments");
    xhr.timeout = 180000;
    xhr.upload.onload = () => onStage?.("scanning");
    xhr.onload = () => {
      cleanup();
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        reject(
          new Error(
            "The file service returned an incomplete response. Please retry.",
          ),
        );
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            typeof result.detail === "string"
              ? result.detail
              : "Could not upload this file. Please retry.",
          ),
        );
        return;
      }
      if (result.status !== "ready") {
        reject(new Error("This file could not be verified. Please retry."));
        return;
      }
      resolve(result);
    };
    xhr.onerror = () => {
      cleanup();
      reject(
        new Error("Upload lost connection. Check your connection and retry."),
      );
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("Upload timed out. Try a smaller file or retry."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    xhr.send(body);
  });
  return {
    asset_id: data.id,
    name: data.original_filename,
    content_type: data.content_type,
    size: data.actual_size,
  };
}
