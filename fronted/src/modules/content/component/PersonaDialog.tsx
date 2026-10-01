"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Check, ExternalLink, Loader2, PenLine,
  Plus, Trash2, Users, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin } from "@/lib/icons";
import { useTRPC } from "@/trpc/client";
import { useComposer } from "../context/ComposerContext";
import type { BrandProfile } from "../personaTypes";

type Section = "guide" | "samples" | "accounts";
type BrandDraft = Pick<BrandProfile,
  "niche" | "persona" | "target_audience" | "style_guide" | "writing_rules" |
  "linkedin_instructions" | "goals" | "voice_traits" | "preferred_formats" |
  "calls_to_action" | "restricted_topics"
>;
type Action = { kind: "close" } | { kind: "account"; connectionId: string | null } |
  { kind: "navigate"; url: string };
type Confirmation = { kind: "discard"; action: Action } | { kind: "disconnect"; id: string };

const emptyBrand: BrandDraft = {
  niche: null, persona: null, target_audience: null, style_guide: null,
  writing_rules: null, linkedin_instructions: null, goals: [], voice_traits: [],
  preferred_formats: [], calls_to_action: [], restricted_topics: [],
};
const sections = [
  { id: "guide", label: "Writing guide", icon: PenLine },
  { id: "samples", label: "Writing samples", icon: BookOpen },
  { id: "accounts", label: "Connected accounts", icon: Users },
] as const;
const guideTextFields = [
  { key: "persona", label: "Persona", hint: "Who are you professionally, and what do you want to be known for?", max: 2000, placeholder: "I build B2B tools and share practical lessons from shipping them…" },
  { key: "niche", label: "Focus area", hint: "Your main professional niche.", max: 240, single: true },
  { key: "target_audience", label: "Audience", hint: "Who should your posts speak to, and what matters to them?", max: 5000 },
  { key: "style_guide", label: "Style and vocabulary", hint: "Describe sentence length, rhythm, phrasing, and point of view.", max: 2000 },
  { key: "writing_rules", label: "Writing rules", hint: "Dos and don'ts for hooks, emoji, hashtags, claims, and formatting.", max: 2000 },
  { key: "linkedin_instructions", label: "LinkedIn instructions", hint: "Guidance specific to your LinkedIn posts and professional conversations.", max: 2000 },
] as const;
const guideLists = [
  { key: "voice_traits", label: "Voice traits", hint: "How your writing should sound.", max: 20 },
  { key: "goals", label: "Content goals", hint: "What your content should achieve.", max: 20 },
  { key: "preferred_formats", label: "Preferred formats", hint: "For example: personal story, practical lesson, opinion, case study.", max: 20 },
  { key: "calls_to_action", label: "Calls to action", hint: "How you prefer to invite discussion or a next step.", max: 20 },
  { key: "restricted_topics", label: "Topics and claims to avoid", hint: "Boundaries to respect across drafts.", max: 50 },
] as const;
const lines = (text: string) => [...new Set(text.split("\n").map((line) => line.trim()).filter(Boolean))];
function message(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return /^[\[{]/.test(error.message) ? "Check the field limits and try again." : error.message;
}
function brandValues(profile: BrandProfile | null): BrandDraft {
  return profile ? Object.fromEntries(Object.keys(emptyBrand).map((key) =>
    [key, profile[key as keyof BrandDraft] ?? emptyBrand[key as keyof BrandDraft]],
  )) as BrandDraft : emptyBrand;
}
function Notice({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{text}</span>
      {retry && <Button type="button" variant="outline" size="sm" className="secondary-btn" onClick={retry}>Retry</Button>}
    </div>
  );
}
function Loading({ label }: { label: string }) {
  return <p className="flex items-center gap-2 py-8 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" />{label}</p>;
}
function TextField({ id, label, hint, value, change, max, single = false, placeholder }: {
  id: string; label: string; hint?: string; value: string | null;
  change: (value: string) => void; max: number; single?: boolean; placeholder?: string;
}) {
  return (
    <Field className="gap-2">
      <div className="flex justify-between gap-3">
        <Label htmlFor={id} className="font-subheading text-sm">{label}</Label>
        <span className="text-xs tabular-nums text-neutral-400">{(value ?? "").length}/{max}</span>
      </div>
      {hint && <p id={`${id}-hint`} className="text-sm leading-5 text-neutral-500">{hint}</p>}
      {single ? (
        <Input id={id} value={value ?? ""} maxLength={max} placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => change(event.target.value)}
          className="rounded-lg border-neutral-200 bg-white focus-visible:ring-2 focus-visible:ring-sky-200" />
      ) : (
        <Textarea id={id} value={value ?? ""} maxLength={max} rows={4} placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => change(event.target.value)}
          className="min-h-28 resize-y rounded-lg border-neutral-200 bg-white p-3 focus-visible:ring-2 focus-visible:ring-sky-200" />
      )}
    </Field>
  );
}
function ListField({ id, label, hint, value, change, max }: {
  id: string; label: string; hint: string; value: string[];
  change: (value: string[]) => void; max: number;
}) {
  const [text, setText] = useState(value.join("\n"));
  const invalid = value.length > max || value.some((item) => item.length > 500);
  return (
    <Field className="gap-2">
      <Label htmlFor={id} className="font-subheading text-sm">{label}</Label>
      <p id={`${id}-hint`} className="text-sm text-neutral-500">{hint} One item per line (max {max}).</p>
      <Textarea id={id} value={text} rows={3} aria-invalid={invalid} aria-describedby={`${id}-hint`}
        onChange={(event) => { setText(event.target.value); change(lines(event.target.value)); }}
        className="min-h-24 resize-y rounded-lg border-neutral-200 bg-white p-3 focus-visible:ring-2 focus-visible:ring-sky-200" />
      {invalid && <p className="text-xs text-red-600">Use up to {max} items, each under 500 characters.</p>}
    </Field>
  );
}

export function PersonaDialog({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const trpc = useTRPC();
  const router = useRouter();
  const { state: composer, setSettings } = useComposer();
  const cache = useQueryClient();
  const [section, setSection] = useState<Section>("guide");
  const [brandEdit, setBrand] = useState<BrandDraft | null>(null);
  const [sampleEdit, setSamples] = useState<{ connectionId: string; samples: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const workspaceQuery = useQuery({ ...trpc.workspace.current.queryOptions(), enabled: open });
  const brandQuery = useQuery({ ...trpc.persona.brand.queryOptions(), enabled: open });
  const accountsQuery = useQuery({ ...trpc.workspace.listLinkedInConnections.queryOptions(), enabled: open });
  const activeAccount = composer.composer.connection_id
    ? accountsQuery.data?.find((account) => account.id === composer.composer.connection_id)
    : accountsQuery.data?.find((account) => account.is_primary) ?? accountsQuery.data?.[0];
  const accountName = activeAccount
    ? [activeAccount.first_name, activeAccount.last_name].filter(Boolean).join(" ") || activeAccount.public_identifier
    : "";
  const sampleAccount = sampleEdit
    ? accountsQuery.data?.find((account) => account.id === sampleEdit.connectionId)
    : activeAccount;
  const sampleAccountName = sampleAccount
    ? [sampleAccount.first_name, sampleAccount.last_name].filter(Boolean).join(" ") || sampleAccount.public_identifier
    : "";
  const sampleInput = { connectionId: sampleAccount?.id };
  const samplesQuery = useQuery({ ...trpc.persona.samples.queryOptions(sampleInput), enabled: open && !!sampleAccount && section === "samples" });
  const saveBrand = useMutation(trpc.persona.saveBrand.mutationOptions());
  const saveSamples = useMutation(trpc.persona.saveSamples.mutationOptions());
  const setPrimary = useMutation(trpc.workspace.setPrimaryLinkedInConnection.mutationOptions());
  const disconnect = useMutation(trpc.workspace.disconnectLinkedIn.mutationOptions());
  const brand = brandEdit ?? brandValues(brandQuery.data ?? null);
  const samples = sampleEdit?.samples ?? samplesQuery.data?.writing_samples ?? [];
  const brandDirty = brandEdit !== null && JSON.stringify(brand) !== JSON.stringify(brandValues(brandQuery.data ?? null));
  const sampleDirty = sampleEdit !== null && JSON.stringify(samples) !== JSON.stringify(samplesQuery.data?.writing_samples ?? []);
  const busy = saveBrand.isPending || saveSamples.isPending || setPrimary.isPending || disconnect.isPending;
  const canSave = !busy && (section === "guide"
    ? brandQuery.isSuccess && brandDirty
    : section === "samples" && !!sampleAccount && samplesQuery.isSuccess && sampleDirty);
  function editSamples(next: string[]) {
    if (!sampleAccount) return;
    setSamples({ connectionId: sampleAccount.id, samples: next }); setSaved(false); setError(null);
  }
  function perform(action: Action) {
    setConfirmation(null);
    if (action.kind === "account") {
      setSettings({ connection_id: action.connectionId }); setSamples(null); setError(null); setSaved(false);
    } else {
      setOpen(false);
      if (action.kind === "navigate") router.push(action.url);
    }
  }
  function request(action: Action) {
    if (busy) return;
    if (action.kind === "account" && action.connectionId === composer.composer.connection_id) return;
    const dirty = action.kind === "account" ? sampleDirty : brandDirty || sampleDirty;
    if (dirty) setConfirmation({ kind: "discard", action });
    else perform(action);
  }
  function editBrand(next: BrandDraft) { setBrand(next); setSaved(false); setError(null); }
  function invalidList(items: string[], max: number) {
    return items.length > max || items.some((item) => item.length > 500);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setError(null); setSaved(false);
    if (section === "guide") {
      const invalid = guideLists.find((field) => invalidList(brand[field.key], field.max));
      if (invalid) { setError(`${invalid.label}: use up to ${invalid.max} items, each under 500 characters.`); return; }
      try {
        const result = await saveBrand.mutateAsync(brand);
        cache.setQueryData(trpc.persona.brand.queryKey(), result);
        setBrand(null); setSaved(true);
      } catch (cause) { setError(message(cause, "Could not save writing guide")); }
      return;
    }
    if (!sampleAccount) return;
    const invalidSample = samples.findIndex((sample) => !sample.trim() || sample.length > 10000);
    if (invalidSample >= 0) { setError(`Sample ${invalidSample + 1} needs text under 10,000 characters.`); return; }
    try {
      const result = await saveSamples.mutateAsync({ connectionId: sampleAccount.id, writing_samples: samples });
      cache.setQueryData(trpc.persona.samples.queryKey(sampleInput), result);
      setSamples(null); setSaved(true);
    } catch (cause) { setError(message(cause, "Could not save writing samples")); }
  }
  async function confirm() {
    if (!confirmation || busy) return;
    if (confirmation.kind === "discard") { perform(confirmation.action); return; }
    setError(null);
    try {
      await disconnect.mutateAsync({ connectionId: confirmation.id });
      if (composer.composer.connection_id === confirmation.id) setSettings({ connection_id: null });
      if (sampleEdit?.connectionId === confirmation.id) setSamples(null);
      await cache.invalidateQueries({ queryKey: trpc.workspace.listLinkedInConnections.queryKey() });
      await cache.invalidateQueries({ queryKey: trpc.workspace.getLinkedInConnection.queryKey() });
      setConfirmation(null);
    } catch (cause) {
      setConfirmation(null); setError(message(cause, "Could not complete this action"));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : request({ kind: "close" })}>
        <DialogContent showCloseButton={false} className="flex h-[min(780px,calc(100dvh-2rem))] w-[min(1050px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 text-neutral-900 sm:max-w-none">
          <DialogHeader className="flex-row items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl font-semibold">LinkedIn persona settings</DialogTitle>
              <DialogDescription className="mt-1">{workspaceQuery.data?.name ?? "Your workspace"} · Guide how Outlify writes for you</DialogDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label="Close settings" onClick={() => request({ kind: "close" })}><X className="size-4" /></Button>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav aria-label="Persona settings" className="flex shrink-0 gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50 p-3 sm:w-56 sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
              {sections.map(({ id, label, icon: Icon }) => (
                <Button key={id} type="button" variant="ghost" disabled={busy}
                  onClick={() => { setSection(id); setError(null); setSaved(false); }}
                  className={`h-10 justify-start gap-2 rounded-lg px-3 text-sm ${section === id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600"}`}
                  aria-current={section === id ? "page" : undefined}>
                  <Icon className="size-4" />{label}
                </Button>
              ))}
            </nav>
            <form onSubmit={(event) => void submit(event)} className="flex min-h-0 min-w-0 flex-1 flex-col">
              <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7">
                <fieldset disabled={busy} className="mx-auto min-w-0 max-w-2xl space-y-6">
                  {section === "guide" && (
                    <>
                      <div><h2 className="font-heading text-2xl font-semibold">Writing guide</h2><p className="mt-1 text-sm text-neutral-500">Workspace-wide guidance for LinkedIn posts. Choose a different tone for an individual draft.</p></div>
                      {activeAccount && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                        <div className="min-w-0 flex-1"><p className="font-subheading text-sm">Writing as {accountName}</p><p className="mt-1 text-xs text-neutral-500">{activeAccount.headline || "Profile details come from your connected LinkedIn account."}</p></div>
                        <Button type="button" variant="outline" size="sm" className="secondary-btn" onClick={() => setSection("accounts")}>Change account</Button>
                      </div>}
                      {brandQuery.isPending ? <Loading label="Loading guide…" /> : brandQuery.isError ? (
                        <Notice text={message(brandQuery.error, "Could not load guide")} retry={() => void brandQuery.refetch()} />
                      ) : (
                        <FieldGroup className="gap-6">
                          {guideTextFields.map(({ key, ...field }) => <TextField key={key} id={`guide-${key}`} {...field} value={brand[key]} change={(value) => editBrand({ ...brand, [key]: value })} />)}
                          {guideLists.map(({ key, ...field }) => <ListField key={key} id={`guide-${key}`} {...field} value={brand[key]} change={(value) => editBrand({ ...brand, [key]: value })} />)}
                        </FieldGroup>
                      )}
                    </>
                  )}
                  {section === "samples" && (
                    <>
                      <div><h2 className="font-heading text-2xl font-semibold">Writing samples</h2><p className="mt-1 text-sm text-neutral-500">Paste LinkedIn posts you wrote to help the assistant match your voice. It reads the first five samples.</p></div>
                      {accountsQuery.isPending ? <Loading label="Loading LinkedIn account…" /> : accountsQuery.isError ? (
                        <Notice text={message(accountsQuery.error, "Could not load LinkedIn accounts")} retry={() => void accountsQuery.refetch()} />
                      ) : !sampleAccount ? (
                        <div className="space-y-3 rounded-xl border border-dashed border-neutral-300 p-5">
                          <p className="text-sm text-neutral-500">{composer.composer.connection_id ? "The account selected for this draft is no longer connected. Choose a connected account." : "Connect LinkedIn to add writing samples. Your account details will be used automatically."}</p>
                          <Button type="button" className="primary-btn" onClick={() => accountsQuery.data?.length ? setSection("accounts") : request({ kind: "navigate", url: "/onboarding/status" })}>{accountsQuery.data?.length ? "Choose account" : "Connect LinkedIn"}</Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                            <div className="min-w-0 flex-1"><p className="font-subheading text-sm">{sampleAccountName}</p><p className="mt-1 text-xs text-neutral-500">Samples for this LinkedIn account.</p></div>
                            <Button type="button" variant="outline" size="sm" className="secondary-btn" onClick={() => setSection("accounts")}>Change account</Button>
                          </div>
                          {samplesQuery.isPending ? <Loading label="Loading writing samples…" /> : samplesQuery.isError ? (
                            <Notice text={message(samplesQuery.error, "Could not load writing samples")} retry={() => void samplesQuery.refetch()} />
                          ) : (
                            <div className="space-y-4">
                              {samples.length === 0 && <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No writing samples yet. Add a LinkedIn post that sounds like you.</p>}
                              {samples.map((sample, index) => (
                                <div key={index} className="rounded-xl border border-neutral-200 p-4">
                                  <div className="mb-2 flex items-center justify-between">
                                    <Label htmlFor={`sample-${index}`} className="font-subheading">Sample {index + 1}</Label>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove sample ${index + 1}`} onClick={() => editSamples(samples.filter((_, at) => at !== index))}><Trash2 className="size-4" /></Button>
                                  </div>
                                  <Textarea id={`sample-${index}`} value={sample} maxLength={10000} rows={6}
                                    onChange={(event) => editSamples(samples.map((text, at) => at === index ? event.target.value : text))}
                                    className="min-h-36 resize-y rounded-lg border-neutral-200 p-3 focus-visible:ring-2 focus-visible:ring-sky-200" />
                                  <p className="mt-1 text-right text-xs text-neutral-400">{sample.length}/10000</p>
                                </div>
                              ))}
                              <Button type="button" variant="outline" className="secondary-btn" disabled={samples.length >= 30} onClick={() => editSamples([...samples, ""])}><Plus className="size-4" />Add sample</Button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {section === "accounts" && (
                    <>
                      <div><h2 className="font-heading text-2xl font-semibold">Connected LinkedIn accounts</h2><p className="mt-1 text-sm text-neutral-500">The assistant uses the account selected for your draft, or your primary account automatically.</p></div>
                      {accountsQuery.isPending ? <Loading label="Loading accounts…" /> : accountsQuery.isError ? (
                        <Notice text={message(accountsQuery.error, "Could not load accounts")} retry={() => void accountsQuery.refetch()} />
                      ) : accountsQuery.data?.length ? (
                        <div className="space-y-3">
                          {accountsQuery.data.map((account) => (
                            <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4">
                              <div className="flex size-10 items-center justify-center rounded-full bg-[#e8f3fb] text-[#0a66c2]"><Linkedin className="size-5" /></div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2"><span className="font-subheading font-medium">{[account.first_name, account.last_name].filter(Boolean).join(" ") || account.public_identifier}</span>{account.is_primary && <Badge variant="secondary">Primary</Badge>}{activeAccount?.id === account.id && <Badge variant="outline">Current draft</Badge>}</div>
                                <a href={account.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm text-neutral-500 hover:text-sky-700"><span className="truncate">{account.public_identifier}</span><ExternalLink className="size-3 shrink-0" /></a>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {activeAccount?.id !== account.id && <Button type="button" variant="outline" size="sm" className="secondary-btn" onClick={() => request({ kind: "account", connectionId: account.id })}>Use for draft</Button>}
                                {!account.is_primary && <Button type="button" variant="outline" size="sm" className="secondary-btn" disabled={sampleDirty} onClick={async () => {
                                  setError(null);
                                  try { await setPrimary.mutateAsync({ connectionId: account.id }); await cache.invalidateQueries({ queryKey: trpc.workspace.listLinkedInConnections.queryKey() }); await cache.invalidateQueries({ queryKey: trpc.workspace.getLinkedInConnection.queryKey() }); }
                                  catch (cause) { setError(message(cause, "Could not set primary account")); }
                                }}>Set primary</Button>}
                                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Disconnect ${account.public_identifier}`} disabled={sampleDirty && activeAccount?.id === account.id} onClick={() => setConfirmation({ kind: "disconnect", id: account.id })}><Trash2 className="size-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No LinkedIn accounts are connected to this workspace.</p>}
                      {composer.composer.connection_id && <Button type="button" variant="outline" className="secondary-btn" onClick={() => request({ kind: "account", connectionId: null })}>Use primary account automatically</Button>}
                      {sampleDirty && <p className="text-xs text-neutral-500">Save or discard your writing samples before changing the primary account or disconnecting it.</p>}
                      <Button type="button" className="primary-btn" onClick={() => request({ kind: "navigate", url: "/onboarding/status" })}><Plus className="size-4" />Manage LinkedIn connections</Button>
                    </>
                  )}
                </fieldset>
              </main>
              <footer className="shrink-0 space-y-3 border-t border-neutral-200 bg-neutral-50/60 px-5 py-4 sm:px-8">
                {error && <Notice text={error} />}
                <div className="flex flex-wrap items-center gap-2">
                  <span role="status" className="mr-auto text-xs text-neutral-500">{saved ? "Saved" : brandDirty || sampleDirty ? "Unsaved changes" : "Changes apply to this workspace"}</span>
                  <Button type="button" variant="outline" className="secondary-btn" disabled={busy} onClick={() => request({ kind: "close" })}>Done</Button>
                  {section !== "accounts" && <Button type="submit" className="primary-btn" disabled={!canSave}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save {section === "guide" ? "guide" : "samples"}</Button>}
                </div>
              </footer>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmation !== null} onOpenChange={(next) => { if (!next && !busy) setConfirmation(null); }}>
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="font-heading">{confirmation?.kind === "discard" ? "Discard unsaved changes?" : "Disconnect this LinkedIn account?"}</DialogTitle>
            <DialogDescription>{confirmation?.kind === "discard" ? "Your unsaved edits will be lost." : "This account will no longer be available for publishing in this workspace."}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" className="secondary-btn" disabled={busy} onClick={() => setConfirmation(null)}>{confirmation?.kind === "discard" ? "Keep editing" : "Cancel"}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>{busy && <Loader2 className="size-4 animate-spin" />}{confirmation?.kind === "discard" ? "Discard changes" : "Disconnect"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
