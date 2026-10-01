"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  BarChart3,
  Bookmark,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  FileSpreadsheet,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  MoreHorizontal,
  PenTool,
  Plus,
  Radio,
  Send,
  Settings,
  Sparkles,
  Target,
  User,
  UserCheck,
  Users,
  Workflow,
  Zap,
  LucideIcon,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Linkedin } from "@/lib/icons";
import CreatePost from "@/modules/dashboard/component/CreatePost";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import ProfileMenu from "./ProfileMenu";
// import ProfileMenu from "@/modules/user/component/ProfileMenu";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
  children?: NavItem[];
};

/* -------------------------------------------------------------------------- */
/*                     LINKEDIN OUTREACH & OUTLIFY NAVIGATION                 */
/* -------------------------------------------------------------------------- */

const overviewNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Unified Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
    badge: "3",
  },
];

const contentNavigation: NavItem[] = [
  {
    label: "Content Engine",
    href: "/dashboard/content",
    icon: PenTool,
    children: [
      {
        label: "AI Post Writer",
        href: "/dashboard/content/generator",
        icon: Sparkles,
      },
      {
        label: "Queue & Schedule",
        href: "/dashboard/content/schedule",
        icon: Calendar,
      },
      {
        label: "Drafts",
        href: "/dashboard/content/drafts",
        icon: FileText,
      },
      {
        label: "Viral Library",
        href: "/dashboard/content/inspiration",
        icon: Radio,
      },
    ],
  },
];

const outreachNavigation: NavItem[] = [
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: Send,
    children: [
      {
        label: "All Sequences",
        href: "/dashboard/campaigns",
        icon: Workflow,
        exact: true,
      },
      {
        label: "Connection Invites",
        href: "/dashboard/campaigns/connections",
        icon: UserCheck,
      },
      {
        label: "Smart InMails",
        href: "/dashboard/campaigns/inmails",
        icon: Mail,
      },
    ],
  },
  {
    label: "Prospects & Leads",
    href: "/dashboard/leads",
    icon: Users,
    children: [
      {
        label: "Lead Database",
        href: "/dashboard/leads/database",
        icon: Database,
      },
      {
        label: "Saved Lists",
        href: "/dashboard/leads/lists",
        icon: Bookmark,
      },
      {
        label: "CSV & Sales Nav Import",
        href: "/dashboard/leads/import",
        icon: FileSpreadsheet,
      },
      {
        label: "Email & Phone Finder",
        href: "/dashboard/leads/enrichment",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Auto-Engager",
    href: "/dashboard/engager",
    icon: Zap,
  },
];

const analyticsNavigation: NavItem[] = [
  {
    label: "Outreach Stats",
    href: "/dashboard/analytics/outreach",
    icon: BarChart3,
  },
  {
    label: "Content Growth",
    href: "/dashboard/analytics/content",
    icon: Target,
  },
  {
    label: "Activity Log",
    href: "/dashboard/history",
    icon: History,
  },
];

const resourceNavigation: NavItem[] = [
  {
    label: "Best Practices",
    href: "/docs",
    icon: BookOpen,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

/* -------------------------------------------------------------------------- */
/*                                ACTIVE STATE                                */
/* -------------------------------------------------------------------------- */

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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
  const { open } = useSidebar();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    items.forEach((item) => {
      if (item.children?.some((child) => isItemActive(pathname, child))) {
        setExpanded((prev) => ({
          ...prev,
          [item.href]: true,
        }));
      }
    });
  }, [pathname, items]);

  function toggleExpand(href: string) {
    setExpanded((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  }

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
            const hasActiveChild =
              item.children?.some((child) => isItemActive(pathname, child)) ??
              false;
            const isExpanded = expanded[item.href] ?? hasActiveChild;

            /* Nested item */
            if (item.children) {
              const activeChildIndex = item.children.findIndex((child) =>
                isItemActive(pathname, child),
              );
              return (
                <SidebarMenuItem key={item.href} className="overflow-visible">
                  <SidebarMenuButton
                    type="button"
                    tooltip={item.label}
                    onClick={() => toggleExpand(item.href)}
                    aria-expanded={isExpanded}
                    className={cn(
                      `
                        relative
                        flex
                        h-9
                        w-full
                        cursor-pointer
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

                        [&_svg]:transition-colors
                      `,
                      hasActiveChild && [
                        "secondary-btn",
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
                      ],
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0 transition-colors",
                        hasActiveChild
                          ? "!text-neutral-900 dark:!text-white"
                          : "text-neutral-500 dark:text-[#737373]",
                      )}
                    />

                    {open && (
                      <>
                        <span className="truncate">{item.label}</span>

                        {item.badge && (
                          <span
                            className={cn(
                              `
                                ml-auto
                                rounded-md
                                px-1.5
                                py-0.5
                                text-[9px]
                              `,
                              hasActiveChild
                                ? "bg-neutral-300 dark:bg-white/10 text-neutral-900 dark:text-white/70"
                                : "bg-neutral-200 dark:bg-[#272727] text-neutral-600 dark:text-[#8a8a8a]",
                            )}
                          >
                            {item.badge}
                          </span>
                        )}

                        <ChevronDown
                          className={cn(
                            `
                              ml-auto
                              size-3.5
                              shrink-0
                              text-neutral-400
                              dark:text-[#666666]
                              transition-transform
                              duration-200
                            `,
                            isExpanded && "rotate-180",
                            hasActiveChild
                              ? "!text-neutral-900 dark:!text-white/60"
                              : "!text-neutral-500 dark:!text-[#666666]",
                          )}
                        />
                      </>
                    )}
                  </SidebarMenuButton>

                  {/* Child Items */}
                  {open && isExpanded && (
                    <div className="relative ml-[18px] mt-1">
                      <span
                        className="
                          pointer-events-none
                          absolute
                          left-0
                          top-0
                          h-full
                          w-px
                          bg-neutral-300
                          dark:bg-white/[0.10]
                        "
                      />

                      {activeChildIndex >= 0 && (
                        <span
                          className="
                            pointer-events-none
                            absolute
                            left-0
                            top-0
                            w-[1.5px]
                            rounded-full
                            bg-[#7C5CFC]
                            shadow-[0_0_6px_rgba(124,92,252,0.8),0_0_14px_rgba(124,92,252,0.35)]
                            transition-[height]
                            duration-300
                            ease-out

                            after:absolute
                            after:-bottom-[2px]
                            after:left-1/2
                            after:h-[5px]
                            after:w-[5px]
                            after:-translate-x-1/2
                            after:rounded-full
                            after:bg-[#A78BFA]
                            after:shadow-[0_0_6px_#7C5CFC,0_0_12px_rgba(124,92,252,0.8)]
                            after:content-['']
                          "
                          style={{
                            height: `${activeChildIndex * 34 + 16}px`,
                          }}
                        />
                      )}

                      <SidebarMenuSub className="ml-0 space-y-[2px] overflow-visible border-l-0 pl-2.5">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isItemActive(pathname, child);

                          return (
                            <SidebarMenuSubItem
                              key={child.href}
                              className="overflow-visible"
                            >
                              <SidebarMenuSubButton
                                render={<Link href={child.href} />}
                                className={cn(
                                  `
                                    relative
                                    h-8
                                    overflow-visible
                                    rounded-md
                                    px-2
                                    text-[12px]
                                    font-medium
                                    text-neutral-600
                                    dark:text-[#858585]
                                    transition-all
                                    duration-150

                                    hover:bg-neutral-200/70
                                    hover:text-neutral-900
                                    dark:hover:bg-[#222222]
                                    dark:hover:text-white
                                  `,
                                  childActive && [
                                    "secondary-btn",
                                    "!text-neutral-900 dark:!text-white",
                                  ],
                                )}
                              >
                                <span className="flex w-full items-center gap-2">
                                  <ChildIcon
                                    className={cn(
                                      "size-3.5 shrink-0 transition-colors",
                                      childActive
                                        ? "!text-neutral-900 dark:!text-white"
                                        : "!text-neutral-500 dark:!text-[#606060]",
                                    )}
                                  />

                                  <span
                                    className={cn(
                                      "truncate",
                                      childActive
                                        ? "!text-neutral-900 dark:!text-white"
                                        : "text-neutral-600 dark:text-[#858585]",
                                    )}
                                  >
                                    {child.label}
                                  </span>
                                </span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </div>
                  )}
                </SidebarMenuItem>
              );
            }

            /* Regular Item */
            return (
              <SidebarMenuItem key={item.href} className="overflow-visible">
                <SidebarMenuButton
                  tooltip={item.label}
                  className={cn(
                    `
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
                    `,
                    active && [
                      "secondary-btn",
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
                    ],
                  )}
                >
                  <Link
                    href={item.href}
                    className="flex w-full items-center gap-2.5"
                  >
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
                            "truncate",
                            active && "!text-neutral-900 dark:!text-white",
                          )}
                        >
                          {item.label}
                        </span>

                        {item.badge && (
                          <span
                            className={cn(
                              `
                                ml-auto
                                rounded-md
                                px-1.5
                                py-0.5
                                text-[9px]
                              `,
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
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}




export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

/* -------------------------------------------------------------------------- */
/*                              USER PROFILE                                  */
/* -------------------------------------------------------------------------- */

function SidebarUserFooter() {
  const { open } = useSidebar();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);
  const trpc = useTRPC();
  const { data } = useQuery(trpc.user.me.queryOptions());

  const name = data?.display_name || "";
  const email = data?.email || "";
  const initials = "AS";

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

          <button
            type="button"
            onClick={() => navigate("/dashboard/settings/profile")}
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
              text-neutral-700
              dark:text-[#b7b7b7]
              transition-colors
              hover:bg-neutral-100
              hover:text-neutral-900
              dark:hover:bg-[#292929]
              dark:hover:text-white
            "
          >
            <User className="size-4 text-neutral-500 dark:text-[#777]" />
            LinkedIn Accounts
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/settings/billing")}
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
              text-neutral-700
              dark:text-[#b7b7b7]
              transition-colors
              hover:bg-neutral-100
              hover:text-neutral-900
              dark:hover:bg-[#292929]
              dark:hover:text-white
            "
          >
            <CreditCard className="size-4 text-neutral-500 dark:text-[#777]" />
            Billing & Limits
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/settings")}
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
              text-neutral-700
              dark:text-[#b7b7b7]
              transition-colors
              hover:bg-neutral-100
              hover:text-neutral-900
              dark:hover:bg-[#292929]
              dark:hover:text-white
            "
          >
            <Settings className="size-4 text-neutral-500 dark:text-[#777]" />
            Settings
          </button>

          <div className="my-1 h-px bg-neutral-200 dark:bg-[#303030]" />

          <button
            type="button"
            onClick={() => setIsOpen(false)}
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
          <AvatarFallback className="bg-[#0077b5]/15 text-[11px] font-semibold text-[#0077b5]">
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
/*                                 LOGO                                       */
/* -------------------------------------------------------------------------- */

function BrandLogo() {
  return (
    <div
      className="
        flex
        size-8
        shrink-0
        items-center
        justify-center
        rounded-lg
        border
        border-neutral-200
        dark:border-white/[0.06]
        bg-neutral-200
        dark:bg-[#202020]
      "
    >
      <Linkedin className="size-[17px] text-[#0a66c2]" strokeWidth={2.2} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           PRIMARY CREATE ACTION                            */
/* -------------------------------------------------------------------------- */

function CreateActionButton() {
  const router = useRouter();
  const { open } = useSidebar();

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [moreOpen]);

  const [openPostBuilder, setOpenPostBuilder] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        {/* <CreatePost open={openPostBuilder} setOpen={setOpenPostBuilder} /> */}
        <button
          type="button"
          onClick={() => router.push("/dashboard/content/generator") }
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
              secondary-btn
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
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/dashboard/content/generator");
                  }}
                  className="
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
                "
                >
                  <Sparkles className="size-3.5 text-neutral-500 dark:text-[#777]" />
                  Generate AI Post
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/dashboard/campaigns/new");
                  }}
                  className="
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
                "
                >
                  <Send className="size-3.5 text-neutral-500 dark:text-[#777]" />
                  New Sequence
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/dashboard/leads/import");
                  }}
                  className="
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
                "
                >
                  <FileSpreadsheet className="size-3.5 text-neutral-500 dark:text-[#777]" />
                  Import CSV / Sales Nav
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function QuickCreateActions() {
  const router = useRouter();
  const { open } = useSidebar();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => router.push("/dashboard/content/generator")}
        className="
          secondary-btn
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
        aria-label="Write post"
      >
        <PenTool className="size-4 shrink-0" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-1.5">
      <button
        type="button"
        onClick={() => router.push("/dashboard/content/generator")}
        className="
          secondary-btn
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
        "
      >
        <PenTool
          className="size-3.5 shrink-0 text-neutral-600 dark:text-[#d4d4d4]"
          strokeWidth={2}
        />
        <span className="truncate">Write Post</span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/dashboard/leads/database")}
        className="
          secondary-btn
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
        "
      >
        <Target
          className="size-3.5 shrink-0 text-neutral-600 dark:text-[#d4d4d4]"
          strokeWidth={2}
        />
        <span className="truncate">Find Leads</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN SIDEBAR                                    */
/* -------------------------------------------------------------------------- */

export function AppSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="
        border-none
        border-border
        bg-primary
        text-foreground
      "
    >
      {/* HEADER */}

      <SidebarHeader
        className={`border-b border-border bg-primary ${
          open ? "px-3 py-2.5" : "px-2 py-2"
        }`}
      >
        <ProfileMenu/>
        {/* <div
          className={cn(
            `
              flex
              h-10
              items-center
              gap-2.5
            `,
            !open && "justify-center",
          )}
        >
          <BrandLogo />

          {open && (
            <div className="min-w-0 flex-1">
              <p
                className="
                  truncate
                  text-[14px]
                  font-semibold
                  tracking-[-0.01em]
                  text-neutral-900
                  dark:text-white
                "
              >
                InScale
              </p>

              <p
                className="
                  truncate
                  text-[10px]
                  text-neutral-500
                  dark:text-[#656565]
                "
              >
                Growth &amp; Outreach Suite
              </p>
            </div>
          )}
        </div> */}

        <div className="mt-2 flex flex-col gap-2.5">
          <CreateActionButton />
          {open && <QuickCreateActions />}
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
        <NavigationGroup label="Outlify (Content)" items={contentNavigation} />
        <NavigationGroup
          label="Outreach (Sequences)"
          items={outreachNavigation}
        />
        <NavigationGroup label="Analytics" items={analyticsNavigation} />
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
