import { getApiBase, getAuthHeaders } from "@/lib/http-error";
import { isSameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const maxDuration = 180;

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const upload = request.method === "POST" && path.join("/") === "attachments";
  const read =
    request.method === "GET" &&
    path.length === 2 &&
    /^[a-zA-Z0-9-]{1,36}$/.test(path[0]) &&
    path[1] === "content";
  if (!upload && !read)
    return Response.json(
      { detail: "File endpoint not found" },
      { status: 404 },
    );
  if (!isSameOrigin(request))
    return Response.json({ detail: "Invalid request origin" }, { status: 403 });
  const headers = await getAuthHeaders();
  if (!headers.Authorization)
    return Response.json(
      { detail: "Please sign in to upload or view files" },
      { status: 401 },
    );
  if (upload) {
    if (Number(request.headers.get("content-length")) > 101 * 1024 * 1024)
      return Response.json(
        { detail: "This file is too large" },
        { status: 413 },
      );
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;"))
      return Response.json(
        { detail: "Choose a file to upload" },
        { status: 422 },
      );
    headers["Content-Type"] = contentType;
  }
  try {
    const options: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      cache: "no-store",
      signal: request.signal,
      ...(upload ? { body: request.body, duplex: "half" as const } : {}),
    };
    const response = await fetch(
      `${getApiBase()}/v1/media/${path.map(encodeURIComponent).join("/")}`,
      options,
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return Response.json(
        {
          detail:
            typeof error.detail === "string"
              ? error.detail
              : "Could not process this file. Please retry.",
        },
        { status: response.status },
      );
    }
    const outgoing = new Headers({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
      "content-type",
      "content-length",
      "content-disposition",
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      { detail: "File service is unavailable. Please retry." },
      { status: 502 },
    );
  }
}

export const POST = proxy;
export const GET = proxy;
