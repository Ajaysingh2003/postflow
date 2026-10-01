"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

export interface AttachedAsset {
  id: string;
  url: string;
  type: "image" | "video" | "document";
  name?: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  thought?: string;
  artifact?: {
    text: string;
    diffOriginal?: string;
  };
  commentary?: string;
  createdAt: number;
}

interface ContentContextType {
  // Main Draft / Canvas State
  draftContent: string;
  setDraftContent: (content: string) => void;
  attachedAssets: AttachedAsset[];
  addAsset: (asset: AttachedAsset) => void;
  removeAsset: (id: string) => void;
  clearAssets: () => void;

  // AI Copilot State
  selectedPersona: string;
  setSelectedPersona: (persona: string) => void;
  messages: AssistantMessage[];
  addMessage: (message: Omit<AssistantMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;
  isGenerating: boolean;
  setIsGenerating: (loading: boolean) => void;

  // Direct Editor Actions
  applyDraftText: (newText: string) => void;
  insertDraftText: (textToInsert: string) => void;
  resetAll: () => void;
}

const ContentContext = createContext<ContentContextType | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [draftContent, setDraftContent] = useState<string>("");
  const [attachedAssets, setAttachedAssets] = useState<AttachedAsset[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("default");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const addAsset = useCallback((asset: AttachedAsset) => {
    setAttachedAssets((prev) => [...prev, asset]);
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAssets = useCallback(() => {
    setAttachedAssets([]);
  }, []);

  const addMessage = useCallback(
    (msg: Omit<AssistantMessage, "id" | "createdAt">) => {
      const newMessage: AssistantMessage = {
        ...msg,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const applyDraftText = useCallback((newText: string) => {
    setDraftContent(newText);
  }, []);

  const insertDraftText = useCallback((textToInsert: string) => {
    setDraftContent((prev) => (prev ? `${prev}\n\n${textToInsert}` : textToInsert));
  }, []);

  const resetAll = useCallback(() => {
    setDraftContent("");
    setAttachedAssets([]);
    setMessages([]);
    setIsGenerating(false);
  }, []);

  const value = useMemo(
    () => ({
      draftContent,
      setDraftContent,
      attachedAssets,
      addAsset,
      removeAsset,
      clearAssets,
      selectedPersona,
      setSelectedPersona,
      messages,
      addMessage,
      clearMessages,
      isGenerating,
      setIsGenerating,
      applyDraftText,
      insertDraftText,
      resetAll,
    }),
    [
      draftContent,
      attachedAssets,
      selectedPersona,
      messages,
      isGenerating,
      addAsset,
      removeAsset,
      clearAssets,
      addMessage,
      clearMessages,
      applyDraftText,
      insertDraftText,
      resetAll,
    ]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
}