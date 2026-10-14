import type { ComposerState } from "./context/ComposerContext";

/** The workspace brand is loaded by the backend, never copied into browser preferences. */
export function assistantDraftRequest(
  state: ComposerState,
  prompt: string,
  accountId?: string,
) {
  return {
    feature: "rewrite_with_tone",
    platform: state.platform,
    input_data: {
      text: (state.content.trim() ? state.content : prompt).slice(0, 10000),
      tone: [state.tone, prompt].filter(Boolean).join("\n").slice(0, 10000),
    },
    ...(accountId ? { connected_account_id: accountId } : {}),
  };
}
