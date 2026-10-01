"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDraftWorkspace } from "../component/editor/useDraftWorkspace";
import DraftSidebar from "../component/editor/DraftSidebar";
import LinkedInEditor from "../component/editor/LinkedInEditor";
import PostActions from "../component/editor/PostActions";

export default function GeneratorView() {
  const w = useDraftWorkspace();
  const [preview, setPreview] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const locked =
    busy || actionBusy || w.uploadBusy || w.saving || w.archive.isPending;
  function navigate(action: () => void) {
    if (locked) return;
    if (w.dirty) setPending(() => action);
    else action();
  }
  function newDraft() {
    navigate(() => {
      w.loadDraft({ draftId: null, content: "" });
      setSidebar(false);
      setPreview(false);
    });
  }
  async function openLinkedIn() {
    try {
      await navigator.clipboard.writeText(w.state.content);
      window.open(
        "https://www.linkedin.com/feed/",
        "_blank",
        "noopener,noreferrer",
      );
      toast.success(
        "Post copied. Add media and review it in LinkedIn before publishing.",
      );
    } catch {
      toast.error("Could not copy your post. Check clipboard permissions.");
    }
  }
  if (w.workspaceError)
    return (
      <div role="alert" className="space-y-3 p-8 text-sm text-muted-foreground">
        <p>Could not load your workspace.</p>
        <Button onClick={w.retryWorkspace} className="secondary-btn rounded-lg">
          Retry
        </Button>
      </div>
    );
  if (!w.isHydrated)
    return (
      <div
        role="status"
        className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground"
      >
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading your workspace…
      </div>
    );
  return (
    <div className="flex h-full pt-10 min-h-0 min-w-0 bg-muted/40 text-foreground">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-8 pb-32 sm:px-5 sm:pt-12">
          {w.accountError && (
            <p
              role="alert"
              className="mx-auto mb-4 max-w-[600px] rounded-lg border border-destructive/20 bg-background p-3 text-xs text-destructive"
            >
              Could not load your LinkedIn account.{" "}
              <Button
                variant="link"
                className="h-auto p-0 text-xs underline"
                onClick={() => void w.primary.refetch()}
              >
                Retry
              </Button>
            </p>
          )}
          {!w.primary.isPending && !w.account && !w.accountError && (
            <p className="mx-auto mb-4 max-w-[600px] rounded-lg border border-border bg-background p-3 text-xs leading-6 text-muted-foreground">
              You can write and save now.{" "}
              <Link
                href="/onboarding/connect-account"
                className="text-sky-600 underline"
              >
                Connect LinkedIn
              </Link>{" "}
              to use your profile and publish a post.
            </p>
          )}
          <LinkedInEditor
            key={w.state.localId}
            workspace={w}
            preview={preview}
            onBusy={setBusy}
          />
          {preview && w.state.content.trim() && (
            <div className="mx-auto mt-4 max-w-[600px] text-center">
              <Button
                onClick={() => void openLinkedIn()}
                disabled={locked}
                className="secondary-btn rounded-lg"
              >
                <ExternalLink />
                Copy & open LinkedIn
              </Button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Add your media, mentions, and first comment in LinkedIn before
                publishing manually.
              </p>
            </div>
          )}
        </div>
        <PostActions
          key={w.state.localId}
          workspace={w}
          preview={preview}
          onPreview={() => setPreview(!preview)}
          disabled={locked || !!pending}
          onBusy={setActionBusy}
          onDrafts={() => setSidebar(true)}
          onNew={newDraft}
        />
      </div>
      <Dialog
        open={sidebar}
        onOpenChange={(open) => !locked && setSidebar(open)}
      >
        <DialogContent className="h-[85dvh] max-w-sm overflow-hidden p-0 sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Your posts</DialogTitle>
            <DialogDescription>Find and open a draft.</DialogDescription>
          </DialogHeader>
          <DraftSidebar
            workspace={w}
            onAccount={(id) =>
              navigate(() => {
                w.loadDraft({ draftId: null, content: "" });
                w.setSettings({ connection_id: id });
              })
            }
            onNew={newDraft}
            onSelect={(draft) =>
              navigate(() => {
                w.select(draft);
                setSidebar(false);
                setPreview(false);
              })
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => !open && !locked && setPending(null)}
      >
        <DialogContent className="max-w-md rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              Save your changes?
            </DialogTitle>
            <DialogDescription>
              Save this draft to your workspace before switching, or discard
              these changes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={locked}
              variant="ghost"
              className="rounded-lg"
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={locked}
              className="secondary-btn rounded-lg"
              onClick={() => {
                pending?.();
                setPending(null);
              }}
            >
              Discard changes
            </Button>
            <Button
              disabled={locked}
              className="primary-btn rounded-lg"
              onClick={async () => {
                if (await w.save()) {
                  pending?.();
                  setPending(null);
                }
              }}
            >
              {w.saving ? <Loader2 className="animate-spin" /> : <Save />}Save &
              continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
