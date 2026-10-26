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
export function validatePostAsset(file: File, supported: string[]) {
  const type = fileType(file);
  if (!type || (supported.length && !supported.includes(type)))
    throw new Error(`${file.name}: choose a file type supported by this channel.`);
  if (!file.size) throw new Error(`${file.name} is empty.`);
  const limit = type === "video/mp4" ? 100 : 20;
  if (file.size > limit * 1024 * 1024)
    throw new Error(`${file.name} exceeds ${limit} MB.`);
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
  onStage?: (stage: "uploading" | "verifying") => void,
  signal?: AbortSignal,
): Promise<SourceAsset> {
  if (purpose === "assistant") validateSource(file);
  else validatePostAsset(file, []);
  const requestSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(180_000),
  ]);
  let requestStage: "starting" | "storage" | "verification" = "starting";
  async function metadata(path: string, body: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: requestSignal,
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        typeof result?.detail === "string"
          ? result.detail
          : "Could not verify this file. Please retry.",
      );
    if (!result) throw new Error("The file service returned an incomplete response. Please retry.");
    return result;
  }
  onStage?.("uploading");
  try {
    const ticket = await metadata("/api/media/uploads", {
      filename: file.name,
      content_type: fileType(file),
      size: file.size,
      purpose,
    });
    if (!ticket.asset_id || !ticket.upload_url || ticket.method !== "PUT")
      throw new Error("Could not start this upload. Please retry.");
    // Only metadata reaches Next.js. File bytes go straight to private R2 quarantine.
    requestStage = "storage";
    const uploaded = await fetch(ticket.upload_url, {
      method: "PUT",
      headers: ticket.headers,
      body: file,
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      signal: requestSignal,
    });
    if (!uploaded.ok)
      throw new Error("Could not upload to file storage. Please retry or contact support.");
    requestStage = "verification";
    onStage?.("verifying");
    const data = await metadata(
      `/api/media/uploads/${encodeURIComponent(ticket.asset_id)}/complete`,
      {},
    );
    if (data.status !== "ready")
      throw new Error("This file could not be verified. Please retry.");
    return {
      asset_id: data.id,
      name: data.original_filename,
      content_type: data.content_type,
      size: data.actual_size,
    };
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (requestSignal.aborted) throw new Error("Upload timed out. Please retry.");
    if (error instanceof TypeError) {
      const messages = {
        starting: "The upload service could not be reached. Check your connection and retry.",
        storage: "File storage could not be reached. Check your connection and retry.",
        verification: "The file was uploaded, but verification could not be reached. Please retry.",
      };
      throw new Error(messages[requestStage]);
    }
    throw error;
  }
}
