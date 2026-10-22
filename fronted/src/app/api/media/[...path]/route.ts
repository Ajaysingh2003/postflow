import { getApiBase, getAuthHeaders } from "@/lib/http-error";
import { isSameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const maxDuration = 180;

async function smallJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Send upload metadata as JSON");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Upload metadata is missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("Upload metadata is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid upload metadata");
  return JSON.stringify(body);
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const assetId = /^[a-zA-Z0-9-]{1,36}$/;
  const start = request.method === "POST" && path.length === 1 && path[0] === "uploads";
  const complete = request.method === "POST" && path.length === 3 &&
    path[0] === "uploads" && assetId.test(path[1]) && path[2] === "complete";
  const read = request.method === "GET" && path.length === 2 &&
    assetId.test(path[0]) && path[1] === "content";
  if (!start && !complete && !read)
    return Response.json({ detail: "File endpoint not found" }, { status: 404 });
  if (!isSameOrigin(request))
    return Response.json({ detail: "Invalid request origin" }, { status: 403 });
  const headers = await getAuthHeaders();
  if (!headers.Authorization)
    return Response.json({ detail: "Please sign in to upload or view files" }, { status: 401 });
  let body: string | undefined;
  if (!read) {
    try {
      body = await smallJson(request);
    } catch (error) {
      return Response.json({ detail: error instanceof SyntaxError ? "Invalid upload metadata" :
        error instanceof Error ? error.message : "Invalid upload metadata" }, { status: 422 });
    }
  }
  try {
    const target = read ? `${encodeURIComponent(path[0])}/download` : path.map(encodeURIComponent).join("/");
    const response = await fetch(`${getApiBase()}/v1/media/${target}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: read ? "{}" : body,
      cache: "no-store",
      signal: request.signal,
    });
    const result = await response.json().catch(() => null);
    const outgoing = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!response.ok)
      return Response.json({ detail: typeof result?.detail === "string" ? result.detail :
        "Could not process this file. Please retry." }, { status: response.status, headers: outgoing });
    if (!result) throw new Error("Incomplete file service response");
    if (read) {
      // Large previews also bypass Vercel response limits. Only ready files get a signed URL.
      const url = new URL(result.download_url);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid file URL");
      return new Response(null, { status: 307, headers: {
        ...outgoing, Location: url.toString(), "Referrer-Policy": "no-referrer",
      } });
    }
    return Response.json(result, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ detail: "File service is unavailable. Please retry." }, { status: 502 });
  }
}

export const POST = proxy;
export const GET = proxy;
