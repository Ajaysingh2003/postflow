"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { RefObject, Suspense, useEffect, useRef, useState } from "react";

import {
  BarChart3,
  Bot,
  Calendar,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  LucideIcon,
  MessageSquare,
  MoreHorizontal,
  PenTool,
  Plug,
  Plus,
  Repeat2,
  Settings,
  Sparkles,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import ProfileMenu from "./ProfileMenu";

const AgentsDialog = dynamic(() => import("@/modules/agents/AgentsDialog"), {
  ssr: false,
});

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                   */
/* -------------------------------------------------------------------------- */

const ROUTES = {
  dashboard: "/dashboard",
  content: "/dashboard/content",
  compose: "/dashboard/content",
  schedule: "/dashboard/schedule",
  assistant: "/dashboard/assistant",
  repurpose: "/dashboard/assistant/repurpose",
  posts: "/dashboard/posts",
  channels: "/dashboard/channels",
  analytics: "/dashboard/analytics",
  agents: "/dashboard/agents",
  settings: "/dashboard/settings",
  profile: "/dashboard/settings/profile",
  billing: "/settings/billing",
} as const;

const NEW_DRAFT_PATHS = [
  "/dashboard/content",
  "/dashboard/content/compose",
  "/dashboard/content/generator",
];

/* -------------------------------------------------------------------------- */
/*                                 NAVIGATION                                 */
/* -------------------------------------------------------------------------- */

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
};

const overviewNavigation: NavItem[] = [
  {
    label: "Home",
    href: ROUTES.dashboard,
    icon: LayoutDashboard,
    exact: true,
  },
];

const createNavigation: NavItem[] = [
  { label: "Content", href: ROUTES.content, icon: PenTool, exact: true },
  { label: "Schedule", href: ROUTES.schedule, icon: Calendar },
];

const manageNavigation: NavItem[] = [
  { label: "Posts", href: ROUTES.posts, icon: MessageSquare },
  { label: "Channels", href: ROUTES.channels, icon: Plug },
  { label: "Analytics", href: ROUTES.analytics, icon: BarChart3 },
];

const extraNavigation: NavItem[] = [
  { label: "Agents", href: ROUTES.agents, icon: Bot, badge: "New" },
];

/* -------------------------------------------------------------------------- */
/*                               SHARED STYLES                                */
/* -------------------------------------------------------------------------- */

/**
 * One gutter for everything. Header, content and footer all use GUTTER, and
 * every row inside uses ROW_X, so icons, labels, buttons and the avatar all
 * share the same left edge.
 */
const GUTTER = "px-3";
const ROW_X = "px-2.5";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFC]/40";

const NAV_BUTTON =
  "relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium " +
  "text-neutral-600 dark:text-neutral-400 transition-colors duration-150 " +
  "hover:bg-neutral-900/[0.05] hover:text-neutral-900 " +
  "dark:hover:bg-white/[0.06] dark:hover:text-white " +
  FOCUS_RING;

const NAV_BUTTON_ACTIVE =
  "!bg-neutral-900/[0.07] !text-neutral-900 dark:!bg-white/[0.09] dark:!text-white " +
  "before:absolute before:left-[3px] before:top-1/2 before:h-4 before:w-[2.5px] " +
  "before:-translate-y-1/2 before:rounded-full before:bg-[#7C5CFC] before:content-['']";

const MENU_PANEL =
  "absolute z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 " +
  "shadow-lg dark:border-white/[0.08] dark:bg-[#1b1b1b] dark:shadow-2xl dark:shadow-black/50";

const MENU_ITEM =
  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] " +
  "font-medium text-neutral-700 dark:text-neutral-300 transition-colors " +
  "hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-white/[0.06] dark:hover:text-white " +
  FOCUS_RING;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function isItemActive(
  pathname: string,
  item: { href: string; exact?: boolean },
) {
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [ref, active, onOutside]);
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  if (!source) return "PF";

  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "PF";
}

/* -------------------------------------------------------------------------- */
/*                             NAVIGATION GROUP                               */
/* -------------------------------------------------------------------------- */

function NavigationGroup({
  label,
  items,
  onAgentsOpen,
  onAgentsIntent,
}: {
  label?: string;
  items: NavItem[];
  onAgentsOpen?: () => void;
  onAgentsIntent?: () => void;
}) {
  const pathname = usePathname();
  const { open: desktopOpen, isMobile, setOpenMobile } = useSidebar();
  const open = isMobile || desktopOpen;

  return (
    <SidebarGroup className="p-0">
      {label && (
        <SidebarGroupLabel
          className={cn(
            ROW_X,
            "mb-1 h-6 text-[11px] font-medium tracking-normal text-neutral-400 dark:text-neutral-500",
            !open && "sr-only",
          )}
        >
          {label}
        </SidebarGroupLabel>
      )}

      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item);
            const opensAgents =
              item.href === ROUTES.agents && Boolean(onAgentsOpen);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  tooltip={item.label}
                  onClick={
                    opensAgents
                      ? () => {
                          if (isMobile) setOpenMobile(false);
                          onAgentsOpen?.();
                        }
                      : undefined
                  }
                  onPointerEnter={opensAgents ? onAgentsIntent : undefined}
                  onFocus={opensAgents ? onAgentsIntent : undefined}
                  aria-haspopup={opensAgents ? "dialog" : undefined}
                  render={
                    opensAgents ? undefined : (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      />
                    )
                  }
                  className={cn(NAV_BUTTON, active && NAV_BUTTON_ACTIVE)}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      active
                        ? "text-[#7C5CFC]"
                        : "text-neutral-400 dark:text-neutral-500",
                    )}
                    strokeWidth={active ? 2.2 : 1.9}
                  />

                  {open && (
                    <>
                      <span className="truncate">{item.label}</span>

                      {item.badge && (
                        <span className="ml-auto rounded-full bg-[#7C5CFC]/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-[#7C5CFC] dark:bg-[#7C5CFC]/20 dark:text-[#a995ff]">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/* -------------------------------------------------------------------------- */
/*                              USER PROFILE                                  */
/* -------------------------------------------------------------------------- */

const ACCOUNT_MENU = [
  { label: "Profile", href: ROUTES.profile, icon: User },
  { label: "Connected Channels", href: ROUTES.channels, icon: Plug },
  { label: "Billing", href: ROUTES.billing, icon: CreditCard },
  { label: "Settings", href: ROUTES.settings, icon: Settings },
] as const;

export function SidebarUserFooterSkeleton() {
  const { open } = useSidebar();
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl p-2",
        !open && "justify-center",
      )}
    >
      <div className="size-8 shrink-0 rounded-full animate-pulse bg-neutral-200 dark:bg-white/10" />
      {open && (
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded animate-pulse bg-neutral-200 dark:bg-white/10" />
          <div className="h-2.5 w-32 rounded animate-pulse bg-neutral-200 dark:bg-white/10" />
        </div>
      )}
    </div>
  );
}

function SidebarUserFooterContent() {
  const { open } = useSidebar();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOutsideClick(dropdownRef, isOpen, () => setIsOpen(false));

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.user.me.queryOptions());
  const logout = useMutation(
    trpc.user.logout.mutationOptions({
      onSuccess: () => {
        router.replace("/login");
        router.refresh();
      },
    }),
  );

  const name = data?.display_name || "";
  const email = data?.email || "";
  const initials = getInitials(name, email);

  function navigate(path: string) {
    setIsOpen(false);
    router.push(path);
  }

  return (
    <div ref={dropdownRef} className="relative">
      {isOpen && (
        <div className={cn(MENU_PANEL, "bottom-full left-0 right-0 mb-2")}>
          {ACCOUNT_MENU.map(({ label, href, icon: ItemIcon }) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={MENU_ITEM}
            >
              <ItemIcon className="size-4 text-neutral-400 dark:text-neutral-500" />
              {label}
            </button>
          ))}

          <div className="my-1.5 h-px bg-neutral-200 dark:bg-white/[0.08]" />

          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className={cn(
              MENU_ITEM,
              "text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60",
              "dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300",
            )}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors",
          "hover:bg-neutral-900/[0.05] dark:hover:bg-white/[0.06]",
          isOpen && "bg-neutral-900/[0.05] dark:bg-white/[0.06]",
          FOCUS_RING,
          !open && "justify-center",
        )}
      >
        <Avatar className="size-8 shrink-0 border border-neutral-200 dark:border-white/10">
          <AvatarImage alt={name} />
          <AvatarFallback className="bg-[#7C5CFC]/15 text-[11px] font-semibold text-[#7C5CFC]">
            {initials}
          </AvatarFallback>
        </Avatar>

        {open && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                {name || "Account"}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-500">
                {email}
              </p>
            </div>

            <ChevronsUpDown className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
          </>
        )}
      </button>
    </div>
  );
}

function SidebarUserFooter() {
  return (
    <Suspense fallback={<SidebarUserFooterSkeleton />}>
      <SidebarUserFooterContent />
    </Suspense>
  );
}

/* -------------------------------------------------------------------------- */
/*                           PRIMARY CREATE ACTION                            */
/* -------------------------------------------------------------------------- */

const MORE_CREATE_OPTIONS = [
  { label: "AI Draft", href: ROUTES.assistant, icon: Sparkles },
  { label: "Repurpose Content", href: ROUTES.repurpose, icon: Repeat2 },
  { label: "Connect Channel", href: ROUTES.channels, icon: Plug },
] as const;

function CreateActionButton() {
  const router = useRouter();
  const { open } = useSidebar();

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useOutsideClick(moreRef, moreOpen, () => setMoreOpen(false));

  function handleNewPost() {
    if (NEW_DRAFT_PATHS.includes(window.location.pathname)) {
      window.dispatchEvent(new Event("draftva:new-draft"));
      window.dispatchEvent(new Event("draftva:new-draft"));
    } else {
      router.push(ROUTES.compose);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleNewPost}
        className={cn(
          "primary-btn flex !h-9 items-center justify-center rounded-lg text-[13px] font-medium",
          open ? "min-w-0 flex-1 gap-2" : "size-9 !px-0",
        )}
      >
        <Plus className="size-4 shrink-0" strokeWidth={2.2} />
        {open && <span>New Post</span>}
      </button>

      {open && (
        <div ref={moreRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMoreOpen((prev) => !prev)}
            aria-label="More create options"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={cn(
              "secondary-btns flex size-9 shrink-0 items-center justify-center rounded-lg !px-0",
              "text-neutral-600 transition-colors hover:text-neutral-900",
              "dark:text-neutral-400 dark:hover:text-white",
              moreOpen && "!text-neutral-900 dark:!text-white",
              FOCUS_RING,
            )}
          >
            <MoreHorizontal className="size-4" strokeWidth={2} />
          </button>

          {moreOpen && (
            <div
              className={cn(MENU_PANEL, "right-0 top-[calc(100%+6px)] w-52")}
            >
              {MORE_CREATE_OPTIONS.map(({ label, href, icon: OptionIcon }) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(href);
                  }}
                  className={MENU_ITEM}
                >
                  <OptionIcon className="size-4 text-neutral-400 dark:text-neutral-500" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN SIDEBAR                                    */
/* -------------------------------------------------------------------------- */

export function AppSidebar() {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  function preloadAgents() {
    void import("@/modules/agents/AgentsDialog");
    void queryClient
      .fetchQuery(
        trpc.workspace.current.queryOptions(undefined, { staleTime: 30000 }),
      )
      .then((workspace) =>
        queryClient.prefetchQuery(
          trpc.agents.settings.queryOptions(
            { workspace_id: workspace.id },
            { staleTime: 30000 },
          ),
        ),
      )
      .catch(() => undefined);
  }
  return (
    <>
      <Sidebar
        collapsible="offcanvas"
        className="w-[var(--sidebar-width)] border-r border-border bg-primary text-foreground"
      >
        {/* HEADER */}
        <SidebarHeader
          className={cn(GUTTER, "gap-3 border-b border-border bg-primary py-3")}
        >
          <ProfileMenu />
          <CreateActionButton />
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent
          className={cn(
            GUTTER,
            "custom-scrollbar flex-1 gap-5 overflow-y-auto bg-primary py-4",
          )}
        >
          <NavigationGroup label="Overview" items={overviewNavigation} />
          <NavigationGroup label="Create" items={createNavigation} />
          <NavigationGroup label="Manage" items={manageNavigation} />
          <NavigationGroup
            label="Extra"
            items={extraNavigation}
            onAgentsOpen={() => setAgentsOpen(true)}
            onAgentsIntent={preloadAgents}
          />
        </SidebarContent>

        {/* FOOTER */}
        <SidebarFooter
          className={cn(GUTTER, "border-t border-border bg-primary py-3")}
        >
          <SidebarUserFooter />
        </SidebarFooter>
      </Sidebar>
      {agentsOpen && <AgentsDialog open onOpenChange={setAgentsOpen} />}
    </>
  );
}
