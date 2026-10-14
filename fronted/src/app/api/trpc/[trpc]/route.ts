import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import { allowedMutationOrigin } from "@/lib/request-origin";

const handler = (req: Request) => {
  if (req.method === "POST") {
    if (
      !allowedMutationOrigin(
        req.headers.get("origin"),
        req.url,
        req.headers.get("host"),
        req.headers.get("sec-fetch-site"),
      )
    ) {
      return new Response("Invalid request origin", { status: 403 });
    }
  }
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
};
export { handler as GET, handler as POST };
