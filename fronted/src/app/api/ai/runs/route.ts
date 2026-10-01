import { getApiBase, getAuthHeaders } from "@/lib/http-error";
import { isSameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ detail: "Invalid request origin" }, { status: 403 });
  const headers = await getAuthHeaders();
  if (!headers.Authorization)
    return Response.json(
      { detail: "Please sign in to use the assistant" },
      { status: 401 },
    );
  const body = await request.text();
  if (body.length > 150000)
    return Response.json(
      { detail: "The conversation is too long" },
      { status: 413 },
    );
  try {
    const response = await fetch(`${getApiBase()}/v1/ai/runs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: request.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return Response.json(
        {
          detail:
            typeof error.detail === "string"
              ? error.detail
              : "Could not start this request. Check your input and try again.",
        },
        { status: response.status },
      );
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Agent-Run-ID": response.headers.get("X-Agent-Run-ID") ?? "",
      },
    });
  } catch {
    return Response.json(
      { detail: "The writing assistant is unavailable. Please retry." },
      { status: 502 },
    );
  }
}
