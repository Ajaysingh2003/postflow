import { describe, expect, test } from "bun:test";
import { readAgentStream } from "../src/modules/content/agentStream";

describe("agent SSE transport", () => {
  test("handles byte-sized UTF-8 fragments, CRLF, comments and duplicate IDs", async () => {
    const events = [
      { type: "run.started", run_id: "run", sequence: 1, status: "running" },
      { type: "text.delta", run_id: "run", sequence: 2, text: "Hello 👋" },
      { type: "text.delta", run_id: "run", sequence: 2, text: "Hello 👋" },
      { type: "run.finished", run_id: "run", sequence: 3, status: "succeeded" },
    ];
    const encoded = new TextEncoder().encode(": heartbeat\r\n\r\n" + events.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join(""));
    const stream = new ReadableStream({ start(controller) { for (const byte of encoded) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
    const received = [];
    await readAgentStream(stream, e => received.push(e));
    expect(received).toEqual([events[0], events[1], events[3]]);
  });
  test("rejects truncated streams instead of marking partial drafts ready", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"run.started","run_id":"r","sequence":1,"status":"running"}\n\n')); controller.close(); } });
    await expect(readAgentStream(stream, () => {})).rejects.toThrow("before the response was ready");
  });
  test("rejects unknown event shapes", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"thought","text":"hidden"}\n\n')); controller.close(); } });
    await expect(readAgentStream(stream, () => {})).rejects.toThrow();
  });
});
