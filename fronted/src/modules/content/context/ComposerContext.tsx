"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  composerSettingsSchema,
  emptySettings,
  type ComposerSettings,
} from "../composerTypes";

export type Platform = "linkedin" | "x";
export type ComposerState = {
  draftId: string | null;
  content: string;
  platform: Platform;
  activePostIndex: number;
  tone: string | null;
  composer: ComposerSettings;
  revision: number | null;
  localId: string;
};
type LoadDraftInput = Partial<ComposerState> & {
  draftId: string | null;
  content: string;
};
const fresh = (): ComposerState => ({
  draftId: null,
  content: "",
  platform: "linkedin",
  activePostIndex: 0,
  tone: null,
  composer: emptySettings(),
  revision: null,
  localId: "scratch",
});
type Value = {
  workspaceError: string | null;
  retryWorkspace: () => void;
  uploadBusy: boolean;
  setUploadBusy: (value: boolean) => void;
  acquireSave: () => boolean;
  releaseSave: () => void;
  state: ComposerState;
  isHydrated: boolean;
  isComposerOpen: boolean;
  setIsComposerOpen:  Dispatch<SetStateAction<boolean>>;
  setDraftId: (id: string | null) => void;
  setContent: (text: string) => void;
  setPlatform: (platform: Platform) => void;
  setActivePostIndex: (index: number) => void;
  setTone: (tone: string | null) => void;
  replaceDraft: (text: string) => void;
  replaceDraftIfCurrent: (localId: string, expected: string, text: string) => void;
  appendContent: (text: string) => void;
  insertContent: (
    text: string,
    options?: { position?: number; addSpacing?: boolean },
  ) => void;
  clearDraft: () => void;
  loadDraft: (draft: LoadDraftInput) => void;
  resetComposer: () => void;
  createNewDraft: (content?: string) => void;
  setSettings: (value: Partial<ComposerSettings>) => void;
  markSaved: (
    localId: string,
    id: string,
    revision: number,
    connectionId: string | null,
  ) => void;
};
const Context = createContext<Value | null>(null);

export function ComposerProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: Partial<ComposerState>;
}) {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const storageKey = workspace.data
    ? `outlify_draft:${workspace.data.id}`
    : null;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [state, setState] = useState<ComposerState>(() => ({
    ...fresh(),
    ...initialData,
  }));
  const [uploadBusy, setUploadBusy] = useState(false);
  const saveLock = useRef(false);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const isHydrated = !!storageKey && storageKey === hydratedKey;
  useEffect(() => {
    if (!storageKey) return;
    let restored = fresh();
    try {
      const saved =
        sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.content === "string")
          restored = {
            ...fresh(),
            ...parsed,
            composer: composerSettingsSchema.parse(parsed.composer ?? {}),
          };
      }
    } catch {
      /* A corrupt local backup must not stop the editor. */
    }
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setState(restored);
        setHydratedKey(storageKey);
      }
    });
    return () => {
      active = false;
    };
  }, [storageKey]);
  useEffect(() => {
    if (!isHydrated || !storageKey) return;
    try {
      const serialized = JSON.stringify(state);
      sessionStorage.setItem(storageKey, serialized);
      localStorage.setItem(storageKey, serialized);
    } catch {
      /* Workspace saving remains available when browser storage is full. */
    }
  }, [state, storageKey, isHydrated]);

  const setContent = useCallback(
    (content: string) => setState((s) => ({ ...s, content })),
    [],
  );
  const setSettings = useCallback(
    (value: Partial<ComposerSettings>) =>
      setState((s) => ({ ...s, composer: { ...s.composer, ...value } })),
    [],
  );
  const loadDraft = useCallback(
    (draft: LoadDraftInput) =>
      setState({
        ...fresh(),
        ...draft,
        localId: draft.localId ?? crypto.randomUUID(),
        composer: draft.composer ?? emptySettings(),
      }),
    [],
  );
  const createNewDraft = useCallback(
    (content = "") => {
      loadDraft({ draftId: null, content });
      setIsComposerOpen(true);
    },
    [loadDraft],
  );
  const markSaved = useCallback(
    (
      localId: string,
      draftId: string,
      revision: number,
      connectionId: string | null,
    ) =>
      setState((s) =>
        s.localId === localId
          ? {
              ...s,
              draftId,
              revision,
              composer: {
                ...s.composer,
                connection_id: s.composer.connection_id ?? connectionId,
              },
            }
          : s,
      ),
    [],
  );
  return (
    <Context.Provider
      value={{
        workspaceError: workspace.error?.message ?? null,
        retryWorkspace: () => {
          void workspace.refetch();
        },
        uploadBusy,
        setUploadBusy,
        acquireSave: () => {
          if (saveLock.current) return false;
          saveLock.current = true;
          return true;
        },
        releaseSave: () => {
          saveLock.current = false;
        },
        state,
        isHydrated,
        isComposerOpen,
        setIsComposerOpen,
        setContent,
        setSettings,
        loadDraft,
        createNewDraft,
        markSaved,
        setDraftId: (draftId) => setState((s) => ({ ...s, draftId })),
        setPlatform: (platform) => setState((s) => ({ ...s, platform })),
        setActivePostIndex: (activePostIndex) =>
          setState((s) => ({ ...s, activePostIndex })),
        setTone: (tone) => setState((s) => ({ ...s, tone })),
        replaceDraft: setContent,
        replaceDraftIfCurrent: (localId, expected, content) =>
          setState((s) => s.localId === localId && s.content === expected ? { ...s, content } : s),
        clearDraft: () => setContent(""),
        resetComposer: () => createNewDraft(),
        appendContent: (text) =>
          setState((s) => ({
            ...s,
            content: [s.content.trimEnd(), text].filter(Boolean).join("\n\n"),
          })),
        insertContent: (text, options) =>
          setState((s) => {
            const at = Math.max(
              0,
              Math.min(options?.position ?? s.content.length, s.content.length),
            );
            const gap = options?.addSpacing === false ? "" : "\n\n";
            return {
              ...s,
              content:
                s.content.slice(0, at) +
                (at ? gap : "") +
                text +
                (at < s.content.length ? gap : "") +
                s.content.slice(at),
            };
          }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useComposer() {
  const context = useContext(Context);
  if (!context)
    throw new Error("useComposer must be used inside ComposerProvider");
  return context;
}
