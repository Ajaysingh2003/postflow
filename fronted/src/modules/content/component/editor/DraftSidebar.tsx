"use client";
import { useState } from "react";
import { Plus, Search, FileText } from "lucide-react";
import AccountAvatar, { accountName } from "./AccountAvatar";
import type { DraftWorkspace } from "./useDraftWorkspace";
import type { SavedDraft } from "../../composerTypes";
export default function DraftSidebar({
  workspace: w,
  onNew,
  onSelect,
  onAccount,
}: {
  workspace: DraftWorkspace;
  onNew: () => void;
  onSelect: (draft: SavedDraft) => void;
  onAccount: (id: string) => void;
}) {
  const [tab, setTab] = useState("Drafts");
  const [search, setSearch] = useState("");
  const schedules =
    w.schedules.data
      ?.filter(
        (s) =>
          !s.composer?.connection_id ||
          s.composer.connection_id === w.account?.id,
      )
      .filter((s) =>
        tab === "Posted"
          ? s.status === "user_confirmed_published"
          : ["scheduled", "reminder_due", "reminder_sent", "user_action_required"].includes(s.status),
      ) ?? [];
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-zinc-200 bg-[#fbfcfd]">
      <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4">
        <span className="text-sm font-semibold text-slate-700">Write</span>
        <FileText size={16} className="text-slate-400" />
      </div>
      <div className="flex items-center gap-2 px-4 py-4">
        <AccountAvatar account={w.account} />
        <div className="min-w-0">
          <select
            aria-label="LinkedIn account"
            disabled={w.saving}
            value={w.account?.id ?? ""}
            onChange={(e) => onAccount(e.target.value)}
            className="max-w-full bg-transparent text-sm font-medium outline-none"
          >
            <option value="" disabled>
              {accountName(w.account)}
            </option>
            {w.accounts.data?.map((account) => (
              <option key={account.id} value={account.id}>
                {accountName(account)}
                {account.is_primary ? " · Primary" : ""}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            {w.account?.is_primary
              ? "Primary LinkedIn account"
              : "LinkedIn workspace"}
          </p>
        </div>
      </div>
      <div
        className="mx-3 flex rounded-lg border border-zinc-200 bg-white p-0.5"
        role="tablist"
        aria-label="Posts"
      >
        {["Drafts", "Queue", "Posted"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs ${tab === t ? "bg-zinc-100 font-medium text-zinc-800" : "text-slate-500"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="mx-3 my-3 flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-slate-400">
        <Search size={13} />
        <input
          aria-label="Search drafts"
          placeholder="Search posts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-0 w-full bg-transparent text-xs outline-none"
        />
      </label>
      <button
        onClick={onNew}
        disabled={w.saving}
        className="flex items-center gap-2 border-y border-zinc-100 px-4 py-3 text-left text-xs text-slate-600 hover:bg-white disabled:opacity-50"
      >
        <Plus size={15} />
        New draft
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "Drafts" ? (
          <>
            {!w.state.draftId && (
              <div className="border-l-[3px] border-sky-500 bg-white px-4 py-4">
                <p className="line-clamp-2 text-sm">
                  {w.state.content || "Untitled draft"}
                </p>
                <p className="mt-2 text-[10px] text-slate-400">
                  On this device · LinkedIn
                </p>
              </div>
            )}
            {w.drafts.isError ? (
              <button
                className="p-4 text-xs text-red-600"
                onClick={() => w.drafts.refetch()}
              >
                Could not load drafts. Retry
              </button>
            ) : w.drafts.isPending ? (
              <p className="p-4 text-xs text-slate-400">Loading drafts…</p>
            ) : (
              w.drafts.data
                ?.filter(
                  (d) =>
                    (!d.composer?.connection_id ||
                      d.composer.connection_id === w.account?.id) &&
                    `${d.title} ${d.content}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((d) => (
                  <button
                    disabled={w.saving}
                    key={d.id}
                    onClick={() => onSelect(d)}
                    className={`block w-full border-b border-zinc-100 border-l-[3px] px-4 py-4 text-left hover:bg-white ${d.id === w.state.draftId ? "border-l-sky-500 bg-white" : "border-l-transparent"}`}
                  >
                    <p className="line-clamp-2 text-[13px] text-zinc-700">
                      {d.title}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      LinkedIn · {new Date(d.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
            )}
          </>
        ) : w.schedules.isError ? (
          <button
            onClick={() => w.schedules.refetch()}
            className="p-4 text-xs text-red-600"
          >
            Could not load queue. Retry
          </button>
        ) : w.schedules.isPending ? (
          <p className="p-4 text-xs text-slate-400">Loading queue…</p>
        ) : (
          <>
            {schedules
              .filter((s) =>
                s.content.toLowerCase().includes(search.toLowerCase()),
              )
              .map((s) => (
                <div key={s.id} className="border-b border-zinc-100 p-4">
                  <p className="line-clamp-2 text-xs">{s.content}</p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {new Date(s.scheduled_for).toLocaleString()}
                  </p>
                  {s.final_post_url && (
                    <a
                      className="mt-2 block text-xs text-sky-600"
                      href={s.final_post_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View post ↗
                    </a>
                  )}
                </div>
              ))}
            {!schedules.length && (
              <div className="p-6 text-center text-xs leading-relaxed text-slate-400">
                {tab === "Queue"
                  ? "Your scheduled posts will appear here."
                  : "Published posts will appear after publication is confirmed."}
              </div>
            )}
          </>
        )}
      </div>
      <p className="border-t border-zinc-100 p-4 text-[10px] leading-relaxed text-slate-400">
        Save to workspace to keep a draft available on every device.
      </p>
    </aside>
  );
}
