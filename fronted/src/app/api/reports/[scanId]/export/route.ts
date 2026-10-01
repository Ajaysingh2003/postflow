import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getApiBase } from "@/lib/http-error";


export async function GET(request: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "markdown";
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return Response.json({ detail: "Authentication required" }, { status: 401 });
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/v1/scans/${scanId}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return Response.json({ detail: "The report service is unavailable" }, { status: 502 });
  }
  if (!response.ok) {
    const detail = await response.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      return Response.json({ detail: parsed.detail || "Could not export this report" }, { status: response.status });
    } catch {
      return Response.json({ detail: "Could not export this report" }, { status: response.status });
    }
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") || `attachment; filename="scanlyst-report.${format === "pdf" ? "pdf" : "md"}"`,
    },
  });
}
