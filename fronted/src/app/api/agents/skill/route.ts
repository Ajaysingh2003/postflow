import { TRPCError } from "@trpc/server";
import { caller } from "@/trpc/server";
import { draftvaSkill } from "@/modules/agents/model";

export async function GET() {
  try {
    const workspace = await caller.workspace.current();
    const settings = await caller.agents.settings({
      workspace_id: workspace.id,
    });
    return new Response(draftvaSkill(settings.mcp_url), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="SKILL.md"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status =
      error instanceof TRPCError && error.code === "UNAUTHORIZED" ? 401 : 503;
    return Response.json(
      { error: "Could not download the skill. Sign in and try again." },
      { status },
    );
  }
}
