"use client";
import {
  useMutation,
  useIsMutating,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { useComposer } from "../../context/ComposerContext";
import { type SavedDraft } from "../../composerTypes";

export function useDraftWorkspace() {
  const composer = useComposer();
  const { state, markSaved, loadDraft } = composer;
  const trpc = useTRPC();
  const client = useQueryClient();
  const primary = useQuery(trpc.workspace.getLinkedInConnection.queryOptions());
  const specific = useQuery({
    ...trpc.workspace.getLinkedInConnection.queryOptions({
      connectionId: state.composer.connection_id ?? undefined,
    }),
    enabled: !!state.composer.connection_id,
  });
  const accounts = useQuery(
    trpc.workspace.listLinkedInConnections.queryOptions(),
  );
  const account = state.composer.connection_id ? specific.data : primary.data;
  const drafts = useQuery(trpc.content.getDrafts.queryOptions());
  const schedules = useQuery(trpc.content.schedules.queryOptions());
  const saving =
    useIsMutating({ mutationKey: trpc.content.saveDraft.mutationKey() }) > 0;
  const mutation = useMutation(trpc.content.saveDraft.mutationOptions());
  const archive = useMutation(
    trpc.content.archiveDraft.mutationOptions({
      onSuccess: () =>
        client.invalidateQueries(trpc.content.getDrafts.queryFilter()),
      onError: (error) => toast.error(error.message),
    }),
  );
  const persisted = drafts.data?.find((d) => d.id === state.draftId);
  const settings = {
    ...state.composer,
    connection_id: state.composer.connection_id ?? account?.id ?? null,
  };
  const dirty = !persisted
    ? !!(
        state.content ||
        state.composer.attachments.length ||
        state.composer.comment
      )
    : state.content !== persisted.content ||
      JSON.stringify(settings) !== JSON.stringify(persisted.composer);
  async function save(): Promise<SavedDraft | null> {
    if (saving || composer.uploadBusy) return null;
    if (!state.content.trim() && !settings.attachments.length) {
      toast.error("Write something or add media first");
      return null;
    }
    if (state.content.length > 3000) {
      toast.error("LinkedIn posts can contain up to 3,000 characters");
      return null;
    }
    if (!composer.acquireSave()) return null;
    try {
      const saved = await mutation.mutateAsync({
        id: state.draftId,
        title: state.content.trim().split("\n")[0].slice(0, 80) || "Media post",
        content: state.content,
        composer: settings,
        expected_revision: state.revision ?? undefined,
      });
      markSaved(
        state.localId,
        saved.id,
        saved.current_revision,
        saved.composer.connection_id,
      );
      client.setQueryData(
        trpc.content.getDrafts.queryKey(),
        (old: SavedDraft[] | undefined) => [
          saved,
          ...(old ?? []).filter((d) => d.id !== saved.id),
        ],
      );
      toast.success("Saved to workspace");
      return saved;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save. Your local draft is still here.",
      );
      return null;
    } finally {
      composer.releaseSave();
    }
  }
  function select(draft: SavedDraft) {
    loadDraft({
      draftId: draft.id,
      content: draft.content,
      composer: draft.composer,
      revision: draft.current_revision,
    });
  }
  return {
    ...composer,
    account,
    accounts,
    primary,
    accountError: specific.error ?? primary.error,
    drafts,
    schedules,
    save,
    select,
    dirty,
    saving,
    archive,
  };
}
export type DraftWorkspace = ReturnType<typeof useDraftWorkspace>;
