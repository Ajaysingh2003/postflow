"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RefObject, useEffect, useRef, useState } from "react";

import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronUp,
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import ProfileMenu from "./ProfileMenu";

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                   */
/* -------------------------------------------------------------------------- */

const ROUTES = {
  dashboard: "/dashboard",
  content: "/dashboard/content",
  compose: "/dashboard/content",
  schedule: "/dashboard/content/schedule",
  assistant: "/dashboard/assistant",
  repurpose: "/dashboard/assistant/repurpose",
  posts: "/dashboard/posts",
  channels: "/dashboard/channels",
  analytics: "/dashboard/analytics",
  docs: "/dashboard/help",
  settings: "/dashboard/settings",
  profile: "/dashboard/settings/profile",
  billing: "/settings/billing",
} as const;

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
    label: "Dashboard",
    href: ROUTES.dashboard,
    icon: LayoutDashboard,
    exact: true,
  },
];

const createNavigation: NavItem[] = [
  {
    label: "Content",
    href: ROUTES.content,
    icon: PenTool,
    exact: true,
  },
  {
    label: "Schedule",
    href: ROUTES.schedule,
    icon: Calendar,
  },
  {
    label: "AI Assistant",
    href: ROUTES.assistant,
    icon: Sparkles,
  },
];

const manageNavigation: NavItem[] = [
  {
    label: "Posts & Replies",
    href: ROUTES.posts,
    icon: MessageSquare,
  },
  {
    label: "Channels",
    href: ROUTES.channels,
    icon: Plug,
  },
  {
    label: "Analytics",
    href: ROUTES.analytics,
    icon: BarChart3,
  },
];

const resourceNavigation: NavItem[] = [
  {
    label: "Docs",
    href: ROUTES.docs,
    icon: BookOpen,
  },
  {
    label: "Settings",
    href: ROUTES.settings,
    icon: Settings,
  },
];

/* -------------------------------------------------------------------------- */
/*                               SHARED STYLES                                */
/* -------------------------------------------------------------------------- */

const NAV_BUTTON_BASE = `
  relative
  flex
  h-9
  w-full
  items-center
  gap-2.5
  overflow-visible
  rounded-lg
  px-2.5
  text-[13px]
  font-medium
  text-neutral-600
  dark:text-[#a3a3a3]
  transition-all
  duration-150
  hover:bg-neutral-200/70
  hover:text-neutral-900
  dark:hover:bg-[#222222]
  dark:hover:text-white
`;

const ACTIVE_RAIL = [
  "secondary-btns",
  "!text-neutral-900 dark:!text-white",
  "before:pointer-events-none",
  "before:absolute",
  "before:-left-[9px]",
  "before:top-1/2",
  "before:z-20",
  "before:h-[24px]",
  "before:w-[3px]",
  "before:-translate-y-1/2",
  "before:rounded-r-full",
  "before:bg-[#7C5CFC]",
  "before:shadow-[0_0_8px_rgba(124,92,252,0.35)]",
  "before:content-['']",
];

const ACCOUNT_MENU_ITEM = `
  flex
  w-full
  cursor-pointer
  items-center
  gap-2.5
  rounded-lg
  px-2.5
  py-2
  text-left
  text-[13px]
  text-neutral-700
  dark:text-[#b7b7b7]
  transition-colors
  hover:bg-neutral-100
  hover:text-neutral-900
  dark:hover:bg-[#292929]
  dark:hover:text-white
`;

const MORE_MENU_ITEM = `
  flex
  h-9
  w-full
  items-center
  gap-2.5
  rounded-lg
  px-2.5
  text-left
  text-[12px]
  font-medium
  text-neutral-700
  dark:text-[#b5b5b5]
  transition-colors
  hover:bg-neutral-100
  hover:text-neutral-900
  dark:hover:bg-white/[0.06]
  dark:hover:text-white
`;

const QUICK_BUTTON = `
  secondary-btns
  flex
  h-9
  min-w-0
  flex-1
  items-center
  justify-center
  gap-1.5
  rounded-lg
  px-2.5
  text-[12px]
  font-medium
  text-neutral-700
  dark:text-[#d4d4d4]
  transition-all
  duration-150
  hover:text-neutral-900
  dark:hover:text-white
`;

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
}: {
  label: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const { open: desktopOpen, isMobile, setOpenMobile } = useSidebar();
  const open = isMobile || desktopOpen;

  return (
    <SidebarGroup className="px-1 py-1.5">
      {label && (
        <SidebarGroupLabel
          className={cn(
            `
              h-auto
              px-2.5
              pb-1.5
              pt-2
              text-[10px]
              font-medium
              uppercase
              tracking-[0.12em]
              text-neutral-500
              dark:text-neutral-400
            `,
            !open && "sr-only",
          )}
        >
          {label}
        </SidebarGroupLabel>
      )}

      <SidebarGroupContent>
        <SidebarMenu className="gap-[2px] overflow-visible">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item);

            return (
              <SidebarMenuItem key={item.href} className="overflow-visible">
                <SidebarMenuButton
                  tooltip={item.label}
                  render={
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    />
                  }
                  className={cn(NAV_BUTTON_BASE, active && ACTIVE_RAIL)}
                >
                  <span className="flex w-full items-center gap-2.5">
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0 transition-colors",
                        active
                          ? "!text-neutral-900 dark:!text-white"
                          : "!text-neutral-500 dark:!text-[#737373]",
                      )}
                    />

                    {open && (
                      <>
                        <span
                          className={cn(
                            "truncate text-[14px] font-medium transition-colors",
                            active && "!text-neutral-900 dark:!text-white",
                          )}
                        >
                          {item.label}
                        </span>

                        {item.badge && (
                          <span
                            className={cn(
                              "ml-auto rounded-md px-1.5 py-0.5 text-[9px]",
                              active
                                ? "bg-neutral-300 dark:bg-white/10 text-neutral-900 dark:text-white/70"
                                : "bg-neutral-200 dark:bg-[#292929] text-neutral-600 dark:text-[#999]",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </span>
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

function SidebarUserFooter() {
  const { open } = useSidebar();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOutsideClick(dropdownRef, isOpen, () => setIsOpen(false));

  const trpc = useTRPC();
  const { data } = useQuery(trpc.user.me.queryOptions());
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
        <div
          className="
            absolute
            bottom-full
            left-0
            z-50
            mb-2
            w-60
            overflow-hidden
            rounded-xl
            border
            border-neutral-200
            dark:border-[#303030]
            bg-white
            dark:bg-[#1d1d1d]
            p-1.5
            shadow-xl
            dark:shadow-2xl
            dark:shadow-black/50
          "
        >
          <div className="px-2.5 py-2">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-[#777]">
              ACCOUNT
            </p>
          </div>

          {ACCOUNT_MENU.map(({ label, href, icon: ItemIcon }) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={ACCOUNT_MENU_ITEM}
            >
              <ItemIcon className="size-4 text-neutral-500 dark:text-[#777]" />
              {label}
            </button>
          ))}

          <div className="my-1 h-px bg-neutral-200 dark:bg-[#303030]" />

          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="
              flex
              w-full
              cursor-pointer
              items-center
              gap-2.5
              rounded-lg
              px-2.5
              py-2
              text-left
              text-[13px]
              text-red-600
              dark:text-red-400
              transition-colors
              hover:bg-red-50
              hover:text-red-700
              dark:hover:bg-red-500/10
              dark:hover:text-red-300
            "
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          `
            flex
            w-full
            cursor-pointer
            items-center
            gap-2.5
            rounded-xl
            p-2
            text-left
            transition-colors
            hover:bg-neutral-200/70
            dark:hover:bg-[#222222]
          `,
          !open && "justify-center",
        )}
      >
        <Avatar className="size-8 shrink-0 border border-neutral-300 dark:border-[#323232]">
          <AvatarImage alt={name} />
          <AvatarFallback className="bg-[#7C5CFC]/15 text-[11px] font-semibold text-[#7C5CFC]">
            {initials}
          </AvatarFallback>
        </Avatar>

        {open && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-[#e5e5e5]">
                {name}
              </p>
              <p className="truncate text-[11px] text-neutral-500 dark:text-[#717171]">
                {email}
              </p>
            </div>

            <ChevronUp
              className={cn(
                `
                  size-4
                  shrink-0
                  text-neutral-400
                  dark:text-[#555]
                  transition-transform
                  duration-200
                `,
                isOpen && "rotate-180 text-neutral-700 dark:text-[#888]",
              )}
            />
          </>
        )}
      </button>
    </div>
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

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          if (["/dashboard/content", "/dashboard/content/compose", "/dashboard/content/generator"].includes(window.location.pathname)) window.dispatchEvent(new Event("postflow:new-draft"));
          else router.push(ROUTES.compose);
        }}
        className={cn(
          `
            primary-btn
            flex
            !h-9
            items-center
            justify-center
            rounded-lg
            text-[13px]
            font-medium
          `,
          open ? "w-full gap-2" : "size-9 !px-3",
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
            className={cn(
              `
                secondary-btns
                flex
                size-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                !px-0
                text-neutral-600
                dark:text-[#a3a3a3]
                transition-all
                duration-150
                hover:text-neutral-900
                dark:hover:text-white
              `,
              moreOpen && "!text-neutral-900 dark:!text-white",
            )}
          >
            <MoreHorizontal className="size-4" strokeWidth={2} />
          </button>

          {moreOpen && (
            <div
              className="
                absolute
                left-0
                top-[calc(100%+6px)]
                z-50
                w-48
                overflow-hidden
                rounded-xl
                border
                border-neutral-200
                dark:border-white/[0.07]
                bg-white
                dark:bg-[#1d1d1d]
                p-1.5
                shadow-xl
                dark:shadow-2xl
                dark:shadow-black/50
              "
            >
              {MORE_CREATE_OPTIONS.map(({ label, href, icon: OptionIcon }) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(href);
                  }}
                  className={MORE_MENU_ITEM}
                >
                  <OptionIcon className="size-3.5 text-neutral-500 dark:text-[#777]" />
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

function QuickCreateActions() {
  const router = useRouter();
  const { open } = useSidebar();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => router.push(ROUTES.assistant)}
        className="
          secondary-btns
          flex
          size-9
          items-center
          justify-center
          rounded-lg
          !px-0
          text-neutral-700
          dark:text-[#d4d4d4]
          transition-colors
          hover:text-neutral-900
          dark:hover:text-white
        "
        aria-label="AI assistant"
      >
        <Sparkles className="size-4 shrink-0" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-1.5">
      <button
        type="button"
        onClick={() => router.push(ROUTES.assistant)}
        className={QUICK_BUTTON}
      >
        <Sparkles
          className="size-3.5 shrink-0 text-neutral-600 dark:text-[#d4d4d4]"
          strokeWidth={2}
        />
        <span className="truncate">AI Assist</span>
      </button>

      <button
        type="button"
        onClick={() => router.push(ROUTES.schedule)}
        className={QUICK_BUTTON}
      >
        <Calendar
          className="size-3.5 shrink-0 text-neutral-600 dark:text-[#d4d4d4]"
          strokeWidth={2}
        />
        <span className="truncate">Schedule</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN SIDEBAR                                    */
/* -------------------------------------------------------------------------- */

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="offcanvas"
      className="
        border-r
        border-border
        w-[var(--sidebar-width)]
        bg-primary
        text-foreground
      "
    >
      {/* HEADER */}
      <SidebarHeader className="border-b border-border bg-primary px-3 py-2.5">
        <ProfileMenu />

        <div className="mt-2 flex flex-col gap-2.5">
          <CreateActionButton />
          <QuickCreateActions />
        </div>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent
        className="
          custom-scrollbar
          flex-1
          overflow-y-auto
          bg-primary
          px-1
          py-2
        "
      >
        <NavigationGroup label="Overview" items={overviewNavigation} />
        <NavigationGroup label="Create" items={createNavigation} />
        <NavigationGroup label="Manage" items={manageNavigation} />
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter
        className="
          border-t
          border-border
          bg-primary
          p-2
        "
      >
        <NavigationGroup label="" items={resourceNavigation} />

        <div
          className="
            mx-1
            my-1
            h-px
            bg-neutral-200
            dark:bg-white/[0.055]
          "
        />

        <SidebarUserFooter />
      </SidebarFooter>
    </Sidebar>
  );
}
