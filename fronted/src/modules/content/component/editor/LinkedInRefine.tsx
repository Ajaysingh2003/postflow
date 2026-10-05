"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import RefinePopover from "../../studio/RefinePopover";
import { refinePreferencesKey } from "../../studio/refinement";
import {
  generateLinkedInRefinement,
  linkedInRefineSource,
  type LinkedInRefineSnapshot,
} from "./linkedinRefinement";
import type { LinkedInEditorWorkspace } from "./LinkedInEditor";
import { accountName } from "./AccountAvatar";

export default function LinkedInRefine({
  workspace: w,
  editor,
  onOpen,
}: {
  workspace: LinkedInEditorWorkspace;
  editor: RefObject<HTMLTextAreaElement | null>;
  onOpen: () => void;
}) {
  const trpc = useTRPC();
  const scope = useQuery(trpc.workspace.current.queryOptions());
  const { mutateAsync: runAssistant } = useMutation(trpc.studio.runFeature.mutationOptions());
  const button = useRef<HTMLButtonElement>(null);
  const current = useRef({ w, workspaceId: scope.data?.id });
  useLayoutEffect(() => {
    current.current = { w, workspaceId: scope.data?.id };
  });
  const [snapshot, setSnapshot] = useState<(LinkedInRefineSnapshot & { anchor: HTMLElement | null }) | null>(null);

  function open() {
    if (w.saving || w.uploadBusy || !scope.data) return;
    const start = editor.current?.selectionStart ?? 0;
    const end = editor.current?.selectionEnd ?? 0;
    setSnapshot({
      anchor: button.current,
      state: structuredClone(w.state),
      accountId: w.account?.id,
      workspaceId: scope.data.id,
      ...(end > start ? { start, end } : {}),
    });
    onOpen();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Refine post"
        aria-haspopup="dialog"
        aria-expanded={!!snapshot}
        disabled={w.saving || w.uploadBusy || !scope.data}
        onMouseDown={(event) => event.preventDefault()}
        onClick={open}
        className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 disabled:pointer-events-none disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-white"
      >
        <Sparkles size={17} strokeWidth={1.8} />
        Refine
        <ChevronDown size={13} />
      </button>
      {snapshot && (
        <RefinePopover
          anchor={snapshot.anchor}
          source={linkedInRefineSource(snapshot)}
          platform="linkedin"
          accountName={accountName(w.account)}
          preferencesKey={refinePreferencesKey(snapshot.workspaceId, snapshot.accountId ?? "unconnected-linkedin")}
          onClose={() => setSnapshot(null)}
          onGenerate={(request, signal) => generateLinkedInRefinement({
            snapshot,
            request,
            signal,
            runAssistant,
            isCurrent: () => {
              const latest = current.current;
              return latest.workspaceId === snapshot.workspaceId &&
                latest.w.account?.id === snapshot.accountId &&
                latest.w.state.localId === snapshot.state.localId &&
                latest.w.state.content === snapshot.state.content &&
                JSON.stringify(latest.w.state.composer) === JSON.stringify(snapshot.state.composer) &&
                !latest.w.saving && !latest.w.uploadBusy;
            },
            apply: (text) => w.replaceDraftIfCurrent(snapshot.state.localId, snapshot.state.content, text),
            onError: (message) => toast.error(message),
          })}
        />
      )}
    </>
  );
}
