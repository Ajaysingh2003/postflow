"use client";

import { useEffect, useRef, useState } from "react";
import {
  readAgentStream,
  type AgentEvent,
  type DraftArtifact,
} from "../agentStream";
import type { ComposerState } from "../context/ComposerContext";
import type { SourceAsset } from "../assets";

type Activity = Extract<AgentEvent, { type: "activity" }>;
export type AgentRun = {
  id: string;
  runId?: string;
  scope: string;
  prompt: string;
  text: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  activities: Activity[];
  artifact?: DraftArtifact;
  error?: string;
  attachments: SourceAsset[];
};

export function useAgentChat(state: ComposerState, scope: string) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    return () => controller.current?.abort();
  }, [scope]);
  const current = runs.filter((run) => run.scope === scope);
  const busy = current.some((run) => run.status === "running");

  async function send(prompt: string, attachments: SourceAsset[] = []) {
    if (
      (controller.current && !controller.current.signal.aborted) ||
      prompt.trim().length < 3
    )
      return false;
    const abort = new AbortController();
    controller.current = abort;
    const id = crypto.randomUUID();
    const update = (change: (run: AgentRun) => AgentRun) =>
      setRuns((items) =>
        items.map((run) => (run.id === id ? change(run) : run)),
      );
    setRuns((items) => [
      ...items,
      {
        id,
        scope,
        prompt,
        text: "",
        status: "running",
        activities: [],
        attachments,
      },
    ]);
    try {
      const included = new Set(attachments.map((asset) => asset.asset_id));
      let size = attachments.reduce((total, asset) => total + asset.size, 0);
      const recent = current
        .filter((run) => run.status === "succeeded")
        .slice(-4);
      for (const run of [...recent].reverse())
        for (const asset of run.attachments) {
          if (
            !included.has(asset.asset_id) &&
            included.size < 5 &&
            size + asset.size <= 30 * 1024 * 1024
          ) {
            included.add(asset.asset_id);
            size += asset.size;
          }
        }
      const history = recent.flatMap((run) => [
        {
          role: "user",
          content: (
            run.prompt +
            (run.attachments.some((asset) => !included.has(asset.asset_id))
              ? "\n[Some earlier files are no longer included. Ask the user to reattach them if needed.]"
              : "")
          ).slice(0, 6000),
          attachment_ids: run.attachments
            .filter((asset) => included.has(asset.asset_id))
            .map((asset) => asset.asset_id),
        },
        {
          role: "assistant",
          content: [
            run.text,
            run.artifact
              ? `Proposed draft (not necessarily applied):\n${run.artifact.content}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 6000),
        },
      ]);
      const response = await fetch("/api/ai/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          source_text: state.content,
          draft_id: state.draftId,
          connection_id: state.composer.connection_id,
          tone: state.tone,
          history,
          attachment_ids: attachments.map((asset) => asset.asset_id),
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || "Could not start the assistant. Please retry.",
        );
      }
      if (!response.body)
        throw new Error("Streaming is unavailable. Please retry.");
      await readAgentStream(response.body, (event) => {
        update((run) => {
          if (event.type === "run.started")
            return { ...run, runId: event.run_id };
          if (event.type === "text.delta")
            return { ...run, text: run.text + event.text };
          if (event.type === "artifact")
            return { ...run, artifact: event.artifact };
          if (event.type === "run.error")
            return { ...run, error: event.message };
          if (event.type === "run.finished")
            return { ...run, status: event.status };
          if (event.type === "activity")
            return {
              ...run,
              activities: run.activities.some((a) => a.id === event.id)
                ? run.activities.map((a) => (a.id === event.id ? event : a))
                : [...run.activities, event],
            };
          return run;
        });
      });
    } catch (error) {
      update((run) => ({
        ...run,
        status: abort.signal.aborted ? "cancelled" : "failed",
        artifact: undefined,
        error: abort.signal.aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please retry.",
      }));
    } finally {
      if (controller.current === abort) controller.current = null;
    }
    return true;
  }

  return {
    runs: current,
    busy,
    send,
    stop: () => controller.current?.abort(),
    clear: () => {
      if (!busy) setRuns((items) => items.filter((run) => run.scope !== scope));
    },
  };
}
