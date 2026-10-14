import { createTRPCRouter } from "../init";
import { userRouter } from "@/modules/user/server/procedures";
import { workspaceRouter } from "@/modules/workspace/server/procedures";
import { billingRouter } from "@/modules/billing/server/procedures";
import { contentRouter } from "@/modules/content/server/procedures";
import { personaRouter } from "@/modules/content/server/personaProcedures";
import { studioRouter } from "@/modules/studio/server";
import { assistantChatsRouter } from "@/modules/content/server/chatProcedures";
import { agentsRouter } from "@/modules/agents/server";

export const appRouter = createTRPCRouter({
  user: userRouter,
  workspace: workspaceRouter,
  billing: billingRouter,
  content: contentRouter,
  persona: personaRouter,
  assistantChats: assistantChatsRouter,
  studio: studioRouter,
  agents: agentsRouter,
});

export type AppRouter = typeof appRouter;
