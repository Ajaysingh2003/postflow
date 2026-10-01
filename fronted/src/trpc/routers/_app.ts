import { createTRPCRouter } from "../init";
import { userRouter } from "@/modules/user/server/procedures";
import { workspaceRouter } from "@/modules/workspace/server/procedures";
import { billingRouter } from "@/modules/billing/server/procedures";
import { contentRouter } from "@/modules/content/server/procedures";
import { personaRouter } from "@/modules/content/server/personaProcedures";

export const appRouter = createTRPCRouter({
  user: userRouter,
  workspace: workspaceRouter,
  billing: billingRouter,
  content: contentRouter,
  persona: personaRouter,
});

export type AppRouter = typeof appRouter;
