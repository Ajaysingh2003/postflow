"use client";

import React, { useEffect, useRef } from "react";
import { Building2, Search, User } from "lucide-react";
import type { MentionSearchResult } from "../../server/procedures";

export interface MentionDropdownProps {
  query: string;
  items: MentionSearchResult[];
  isLoading?: boolean;
  selectedIndex: number;
  onSelect: (item: MentionSearchResult) => void;
  onFindOnLinkedIn: (query: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function MentionDropdown({
  query,
  items,
  isLoading,
  selectedIndex,
  onSelect,
  onFindOnLinkedIn,
  onClose,
  position,
}: MentionDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Keep active item in view if scrollable
  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector<HTMLElement>(
      `[data-mention-index="${selectedIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const hasPeople = items.some((i) => i.entity_type === "person");
  const categoryTitle = hasPeople ? "People & Companies" : "Companies";

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="LinkedIn Mention Suggestions"
      style={{
        top: `${position.top}px`,
        left: `${Math.max(12, Math.min(position.left, 280))}px`,
      }}
      className="absolute z-50 w-[240px] rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition-all dark:border-white/[0.12] dark:bg-[#18181b] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
    >
      {/* Category Header */}
      <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400 dark:text-neutral-500">
        {categoryTitle}
      </div>

      {/* Results List */}
      <div className="max-h-[220px] overflow-y-auto overscroll-contain py-0.5 scrollbar-thin">
        {items.map((item, idx) => {
          const isSelected = selectedIndex === idx;

          return (
            <button
              key={item.id || item.profile_url}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-mention-index={idx}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-[#f1f3f5] text-neutral-900 dark:bg-white/[0.08] dark:text-white"
                  : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/[0.04]"
              }`}
            >
              {/* Avatar or Logo */}
              <div className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-neutral-100 dark:bg-neutral-800">
                {item.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatar_url}
                    alt={item.name}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : item.entity_type === "person" ? (
                  <User size={13} className="text-neutral-500" />
                ) : (
                  <Building2 size={13} className="text-neutral-500" />
                )}
              </div>

              {/* Entity Name */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium leading-snug">
                  {item.name}
                </p>
                {item.headline && (
                  <p className="truncate text-[10.5px] text-neutral-400 dark:text-neutral-500">
                    {item.headline}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {items.length === 0 && !isLoading && (
          <div className="px-2.5 py-2 text-[12px] text-neutral-400 dark:text-neutral-500">
            No exact matches found
          </div>
        )}

        {isLoading && items.length === 0 && (
          <div className="flex items-center gap-2 px-2.5 py-2 text-[12px] text-neutral-400">
            <span className="size-2 animate-ping rounded-full bg-neutral-400" />
            Searching LinkedIn...
          </div>
        )}
      </div>

      {/* Footer / Find on LinkedIn */}
      {query.trim().length > 0 && (
        <div className="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/[0.08]">
          <button
            type="button"
            data-mention-index={items.length}
            onMouseDown={(e) => {
              e.preventDefault();
              onFindOnLinkedIn(query);
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
              selectedIndex === items.length
                ? "bg-[#f1f3f5] text-neutral-900 dark:bg-white/[0.08] dark:text-white"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-white/[0.04]"
            }`}
          >
            <Search size={13} className="shrink-0 text-neutral-400" />
            <span className="truncate text-[12px]">
              Find &ldquo;{query.trim()}&rdquo; on LinkedIn
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
