"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  Anchor,
  Award,
  BarChart,
  Bookmark,
  BookOpen,
  Brain,
  Calendar,
  Camera,
  CircleCheck,
  Clock,
  Coffee,
  Compass,
  Edit,
  FileText,
  Flame,
  Glasses,
  Heart,
  Lightbulb,
  ListRestart,
  Maximize2,
  Minimize,
  PenLine,
  Plus,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import WorkspaceDialog from "@/components/base/WorkspaceDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

import type { CommandItem } from "../types";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface CommandDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  commandId?: string;
  command?: CommandItem | null;
  onSuccess?: (savedCommand?: CommandItem) => void;
}

interface IconOption {
  name: string;
  label: string;
  icon: LucideIcon;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

interface EnabledToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_ICON = "Sparkles";

const ICON_OPTIONS: IconOption[] = [
  { name: "Anchor", label: "Anchor", icon: Anchor },
  { name: "Award", label: "Award", icon: Award },
  { name: "BarChart", label: "BarChart", icon: BarChart },
  { name: "Bookmark", label: "Bookmark", icon: Bookmark },
  { name: "BookOpen", label: "BookOpen", icon: BookOpen },
  { name: "Brain", label: "Brain", icon: Brain },
  { name: "Calendar", label: "Calendar", icon: Calendar },
  { name: "Camera", label: "Camera", icon: Camera },
  { name: "CircleCheck", label: "CircleCheck", icon: CircleCheck },
  { name: "Clock", label: "Clock", icon: Clock },
  { name: "Coffee", label: "Coffee", icon: Coffee },
  { name: "Compass", label: "Compass", icon: Compass },
  { name: "Edit", label: "Edit", icon: Edit },
  { name: "FileText", label: "FileText", icon: FileText },
  { name: "Flame", label: "Flame", icon: Flame },
  { name: "Glasses", label: "Glasses", icon: Glasses },
  { name: "Heart", label: "Heart", icon: Heart },
  { name: "Lightbulb", label: "Lightbulb", icon: Lightbulb },
  { name: "ListRestart", label: "ListRestart", icon: ListRestart },
  { name: "Maximize2", label: "Maximize", icon: Maximize2 },
  { name: "Minimize", label: "Minimize", icon: Minimize },
  { name: "PenLine", label: "PenLine", icon: PenLine },
  { name: "Plus", label: "Plus", icon: Plus },
  { name: "Rocket", label: "Rocket", icon: Rocket },
  { name: "Scale", label: "Scale", icon: Scale },
  { name: "Sparkles", label: "Sparkles", icon: Sparkles },
  { name: "Target", label: "Target", icon: Target },
  { name: "Wand2", label: "Wand", icon: Wand2 },
  { name: "Zap", label: "Zap", icon: Zap },
];

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function getIconComponent(iconName: string): LucideIcon {
  return (
    ICON_OPTIONS.find(
      ({ name }) => name.toLowerCase() === iconName.toLowerCase()
    )?.icon ?? Sparkles
  );
}

/* -------------------------------------------------------------------------- */
/*                              Enabled Toggle                                */
/* -------------------------------------------------------------------------- */

function EnabledToggle({
  enabled,
  onChange,
}: EnabledToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full",
          "transition-colors duration-200 ease-in-out focus:outline-none",
          enabled
            ? "bg-blue-500"
            : "bg-neutral-300 dark:bg-neutral-700"
        )}
      >
        <span
          className={cn(
            "relative top-0.5 inline-block size-3 rounded-full bg-white",
            "pointer-events-none transform shadow-sm transition duration-200 ease-in-out",
            enabled ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </button>

      <span className="text-[13px] text-neutral-700 dark:text-neutral-300">
        Enabled
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Icon Picker                                 */
/* -------------------------------------------------------------------------- */

function IconPicker({
  value,
  onChange,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const CurrentIcon = getIconComponent(value);

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return ICON_OPTIONS;
    }

    return ICON_OPTIONS.filter(({ label }) =>
      label.toLowerCase().includes(query)
    );
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const timeout = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  function handleSelect(iconName: string) {
    onChange(iconName);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="absolute right-2 flex items-center"
    >
      <button
        type="button"
        aria-label="Change icon"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          "text-neutral-600 transition-colors",
          "hover:bg-neutral-100 hover:text-neutral-900",
          "dark:text-neutral-400 dark:hover:bg-neutral-800",
          "dark:hover:text-neutral-100"
        )}
      >
        <CurrentIcon className="size-4 stroke-[1.8]" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-50",
            "flex w-[230px] flex-col overflow-hidden rounded-xl",
            "border border-neutral-200 bg-white shadow-xl",
            "animate-in fade-in zoom-in-95 duration-100",
            "dark:border-neutral-800 dark:bg-[#121214]"
          )}
        >
          <IconSearch
            value={search}
            onChange={setSearch}
            inputRef={searchInputRef}
          />

          <IconList
            icons={filteredIcons}
            selectedIcon={value}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Icon Search                                   */
/* -------------------------------------------------------------------------- */

function IconSearch({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
      <Search className="size-3.5 shrink-0 text-neutral-400" />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search..."
        className={cn(
          "w-full bg-transparent text-xs text-neutral-900",
          "placeholder:text-neutral-400 focus:outline-none",
          "dark:text-neutral-100"
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Icon List                                    */
/* -------------------------------------------------------------------------- */

function IconList({
  icons,
  selectedIcon,
  onSelect,
}: {
  icons: IconOption[];
  selectedIcon: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="max-h-[240px] overflow-y-auto p-1">
      {icons.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-neutral-400">
          No icons found
        </div>
      ) : (
        icons.map(({ name, label, icon: Icon }) => {
          const selected =
            name.toLowerCase() === selectedIcon.toLowerCase();

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(name)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg",
                "px-2.5 py-1.5 text-left text-xs transition-colors",
                selected
                  ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
              )}
            >
              <Icon className="size-4 shrink-0 stroke-[1.8] text-neutral-500 dark:text-neutral-400" />

              <span className="truncate">
                {label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Command Dialog                                */
/* -------------------------------------------------------------------------- */

export function CommandDialog({
  open,
  setOpen,
  command,
  onSuccess,
}: CommandDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [name, setName] = useState("");
  const [iconName, setIconName] = useState(DEFAULT_ICON);
  const [prompt, setPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);

  const isEditing = Boolean(command?.label);
  const isCustom = Boolean(command?.isCustom);

  /* ------------------------------------------------------------------------ */
  /*                           Populate form state                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    if (command) {
      setName(command.label);
      setIconName((command.icon as string) || DEFAULT_ICON);
      setPrompt(command.prompt);
    } else {
      setName("");
      setIconName(DEFAULT_ICON);
      setPrompt("");
    }
  }, [open, command]);

  /* ------------------------------------------------------------------------ */
  /*                                Mutations                                 */
  /* ------------------------------------------------------------------------ */

  const saveMutation = useMutation(
    trpc.content.saveCommand.mutationOptions({
      onSuccess(data) {
        toast.success(
          command?.isCustom
            ? "Command updated in database"
            : "Custom command saved to database"
        );

        queryClient.invalidateQueries(
          trpc.content.getCommands.queryFilter()
        );

        onSuccess?.(data);
        setOpen(false);
      },

      onError(error) {
        toast.error(
          error.message || "Failed to save command to database"
        );
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.content.deleteCommand.mutationOptions({
      onSuccess() {
        toast.success("Command deleted");

        queryClient.invalidateQueries(
          trpc.content.getCommands.queryFilter()
        );

        setOpen(false);
      },

      onError(error) {
        toast.error(
          error.message || "Failed to delete command"
        );
      },
    })
  );

  /* ------------------------------------------------------------------------ */
  /*                                Handlers                                  */
  /* ------------------------------------------------------------------------ */

  function handleSubmit() {
    const cleanName = name.trim();
    const cleanPrompt = prompt.trim();

    if (!cleanName) {
      toast.error("Please enter a command name");
      return;
    }

    if (!cleanPrompt) {
      toast.error("Please enter a command message");
      return;
    }

    saveMutation.mutate({
      id: command?.isCustom ? command.id : undefined,
      name: cleanName,
      icon: iconName,
      prompt: cleanPrompt,
    });
  }

  function handleDelete() {
    if (!command?.id || !command.isCustom) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this command?"
    );

    if (!confirmed) return;

    deleteMutation.mutate({
      id: command.id,
    });
  }

  const isPending =
    saveMutation.isPending || deleteMutation.isPending;

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <WorkspaceDialog
      maxWidth="520px"
      handleSubmit={handleSubmit}
      isPending={isPending}
      btnLabel={isEditing ? "Save" : "Create"}
      label={isEditing ? "Edit Command" : "New Command"}
      open={open}
      setOpen={setOpen}
    >
      <div className="space-y-5 py-1 text-xs">
        <EnabledToggle
          enabled={enabled}
          onChange={setEnabled}
        />

        {/* Name ------------------------------------------------------------- */}

        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
            Name
          </label>

          <div className="relative flex items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Polish"
              className={cn(
                "h-10 w-full rounded-lg pr-11 text-xs",
                "border border-neutral-200 bg-white text-neutral-900",
                "placeholder:text-neutral-400",
                "focus-visible:ring-1 focus-visible:ring-neutral-400",
                "dark:border-neutral-800 dark:bg-neutral-900",
                "dark:text-neutral-100"
              )}
            />

            <IconPicker
              value={iconName}
              onChange={setIconName}
            />
          </div>
        </div>

        {/* Prompt ----------------------------------------------------------- */}

        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
            Command Message
          </label>

          <Textarea
            rows={10}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Polish the draft:

When changes are needed, include the polished post(s)...`}
            className={cn(
              "w-full resize-y rounded-lg p-3 text-xs leading-relaxed",
              "border border-neutral-200 bg-white text-neutral-900",
              "placeholder:text-neutral-400",
              "focus-visible:ring-1 focus-visible:ring-neutral-400",
              "dark:border-neutral-800 dark:bg-neutral-900",
              "dark:text-neutral-100"
            )}
          />
        </div>

        {/* Delete ----------------------------------------------------------- */}

        {isCustom && (
          <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                "text-red-600 transition-colors hover:text-red-700",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              <Trash2 className="size-3.5" />
              Delete command
            </button>
          </div>
        )}
      </div>
    </WorkspaceDialog>
  );
}

export default CommandDialog;