import type { ComposerState } from "../../context/ComposerContext";
import type { RefineRequest } from "../../studio/RefinePopover";
import { applyRefinement, refineInstructions } from "../../studio/refinement";
import type { Payload } from "@/modules/studio/types";

export type LinkedInRefineSnapshot = {
  state: ComposerState;
  accountId?: string;
  workspaceId: string;
  start?: number;
  end?: number;
};

type AssistantInput = {
  feature: string;
  platform: string;
  input_data: Payload;
  connected_account_id?: string;
  validation_context: Payload;
  output_language: string;
};
type AssistantResult = {
  output: Payload;
  validation_issues?: { severity: string; message: string }[];
};

export function linkedInRefineSource(snapshot: LinkedInRefineSnapshot) {
  return snapshot.state.content.slice(
    snapshot.start ?? 0,
    snapshot.end ?? snapshot.state.content.length,
  );
}

export async function generateLinkedInRefinement({
  snapshot,
  request,
  signal,
  runAssistant,
  isCurrent,
  apply,
  onError,
}: {
  snapshot: LinkedInRefineSnapshot;
  request: RefineRequest;
  signal: AbortSignal;
  runAssistant: (input: AssistantInput) => Promise<AssistantResult>;
  isCurrent: () => boolean;
  apply: (content: string) => void;
  onError: (message: string) => void;
}) {
  if (!isCurrent())
    throw new Error("Your draft changed. Open Refine again to use the latest text.");
  const source = linkedInRefineSource(snapshot);
  const result = await runAssistant({
    feature: "rewrite_with_tone",
    platform: "linkedin",
    input_data: {
      text: request.previous ?? source,
      tone: refineInstructions(
        request.command,
        request.custom,
        request.preferences,
        request.followup,
      ),
    },
    connected_account_id: snapshot.accountId,
    validation_context: { visibility: snapshot.state.composer.visibility },
    output_language: request.preferences.language,
  });
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const errors = result.validation_issues?.filter((issue) => issue.severity === "error") ?? [];
  if (errors.length) throw new Error(errors.map((issue) => issue.message).join("\n"));
  const text = result.output.rewritten_text;
  if (typeof text !== "string" || !text.trim())
    throw new Error("The assistant returned no revised text. Please retry.");
  return {
    text,
    apply(mode: "replace" | "insert") {
      if (!isCurrent() || signal.aborted) {
        onError("Your draft changed. Open Refine again before applying this response.");
        return false;
      }
      const next = applyRefinement(
        { text: snapshot.state.content },
        "linkedin",
        { index: 0, start: snapshot.start, end: snapshot.end },
        source,
        text,
        mode,
      );
      if (!next || typeof next.text !== "string") return false;
      if (next.text.length > 3000) {
        onError("This edit exceeds LinkedIn’s 3,000-character limit.");
        return false;
      }
      apply(next.text);
      return true;
    },
  };
}
