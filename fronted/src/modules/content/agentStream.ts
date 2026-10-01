import { z } from "zod";

const artifactSchema = z.object({
  id: z.string(), original: z.string(), content: z.string().min(1).max(3000),
  title: z.string(), summary: z.string(),
});
export type DraftArtifact = z.infer<typeof artifactSchema>;
const base = { run_id: z.string(), sequence: z.number() };
export const agentEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("run.started"), status: z.literal("running") }),
  z.object({ ...base, type: z.literal("activity"), id: z.string(), label: z.string(), status: z.enum(["running", "completed", "failed"]), detail: z.string().nullish() }),
  z.object({ ...base, type: z.literal("text.delta"), text: z.string() }),
  z.object({ ...base, type: z.literal("artifact"), artifact: artifactSchema }),
  z.object({ ...base, type: z.literal("run.error"), message: z.string() }),
  z.object({ ...base, type: z.literal("run.finished"), status: z.enum(["succeeded", "failed", "cancelled"]) }),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;

/** Handles UTF-8 and SSE frames split across arbitrary network chunks. */
export async function readAgentStream(body: ReadableStream<Uint8Array>, onEvent: (event: AgentEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let lastSequence = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const event = agentEventSchema.parse(JSON.parse(data));
        if (event.sequence <= lastSequence) continue;
        lastSequence = event.sequence;
        onEvent(event);
        if (event.type === "run.finished") finished = true;
      }
      if (buffer.length > 200000) throw new Error("The assistant sent an invalid response.");
      if (done) break;
    }
    if (!finished) throw new Error("The connection ended before the response was ready. Please retry.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
