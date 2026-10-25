"use client";
import { ChannelLogos } from "./NavPreviews";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Code2,
  Layers3,
  Menu,
  PencilLine,
  Repeat2,
  Share2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/login",
  dashboard: "/dashboard",
  pricing: "/pricing",
  platform: "/#integrations",
  howItWorks: "/#features",
} as const;

type NavEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  image?: string;
};

const composer: NavEntry = {
  id: "composer",
  title: "Social Composer",
  description: "Write once, then tailor the post for each platform.",
  href: "/product/ai-writer", // TODO: give composer its own page
  icon: PencilLine,
};
const ai: NavEntry = {
  id: "ai",
  title: "AI Writing Assistant",
  description: "Draft and rewrite posts in your own voice.",
  href: "/product/ai-writer",
  icon: Bot,
};
const repurposing: NavEntry = {
  id: "repurposing",
  title: "Content Repurposing",
  description: "Turn one post into versions for every channel.",
  href: "/#feature-repurposing",
  icon: Repeat2,
};
const scheduling: NavEntry = {
  id: "scheduling",
  title: "Scheduling & Queue",
  description: "Pick a time, or let the queue publish for you.",
  href: "/product/schedule",
  icon: CalendarDays,
};
const channels: NavEntry = {
  id: "channels",
  title: "Social Integrations",
  description: "Connect all your channels in one workspace.",
  href: "/product/social-integration", // typo kept: matches your current route folder
  icon: Share2,
};
const analytics: NavEntry = {
  id: "analytics",
  title: "Advanced Analytics",
  description: "See which posts perform and when to publish.",
  href: "/product/analytics",
  icon: BarChart3,
};
const mcp: NavEntry = {
  id: "mcp",
  title: "Draftva MCP",
  description: "Let your AI tools draft and schedule posts.",
  href: "/product/mcp",
  icon: Code2,
};

const PRODUCT_COLUMNS: { label: string; items: NavEntry[] }[][] = [
  [{ label: "Create", items: [composer, ai, repurposing] }],
  [
    { label: "Publish", items: [scheduling, channels] },
    { label: "Measure & automate", items: [analytics, mcp] },
  ],
];

const PRODUCT_ITEMS = PRODUCT_COLUMNS.flat().flatMap((g) => g.items);

const SOLUTIONS: NavEntry[] = [
  {
    id: "creators",
    title: "For Creators",
    description: "Grow an audience without living in five tabs.",
    href: ROUTES.howItWorks, // TODO: dedicated pages
    icon: PencilLine,
  },
  {
    id: "founders",
    title: "For Founders",
    description: "Build in public next to building the company.",
    href: ROUTES.howItWorks,
    icon: ArrowUpRight,
  },
  {
    id: "agencies",
    title: "For Agencies",
    description: "Run content for every client from one place.",
    href: ROUTES.howItWorks,
    icon: Layers3,
  },
  {
    id: "teams",
    title: "For Marketing Teams",
    description: "Plan, review and publish together.",
    href: ROUTES.howItWorks,
    icon: UsersRound,
  },
];

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function BrandLogo() {
  return (
    <Link
      href={ROUTES.home}
      aria-label="Draftva home"
      className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3fda8a]"
    >
      <Image
        src="/images/brand/draftva-logo.jpg"
        width={64}
        height={64}
        alt=""
        priority
        className="size-8 rounded-lg object-cover"
      />
      <span className="font-heading text-[17px] font-semibold tracking-tight text-neutral-900">
        Draftva
      </span>
    </Link>
  );
}

/** Screenshots stay mounted and cross-fade so hover never waits on a download. */
function Preview({ items, activeId }: { items: NavEntry[]; activeId: string }) {
  const active = items.find((i) => i.id === activeId) ?? items[0];
  const Icon = active.icon;
  const hasImage = items.some((i) => i.image);

  return (
    <div className="flex h-full flex-col rounded-xl border border-black/[0.07] bg-white p-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-black/[0.06] bg-neutral-50">
        {hasImage &&
          items.map((item) =>
            item.image ? (
              <Image
                key={item.id}
                src={item.image}
                alt={item.id === active.id ? `${active.title} preview` : ""}
                fill
                sizes="300px"
                className={cn(
                  "object-cover object-top transition-opacity duration-200 motion-reduce:transition-none",
                  item.id === active.id ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null,
          )}

        {/* placeholder until this item has a screenshot */}
        {!active.image && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-neutral-800 shadow-sm">
              <Icon size={22} strokeWidth={1.7} />
            </span>
            <ChannelLogos size={24} />
          </div>
        )}
      </div>

      <div className="px-2 pb-2 pt-3">
        <p className="text-[14px] font-semibold text-neutral-900">
          {active.title}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-neutral-600">
          {active.description}
        </p>
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
  onHover,
  onNavigate,
}: {
  item: NavEntry;
  active: boolean;
  onHover: () => void;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavigationMenuLink
      render={<Link href={item.href} />}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onNavigate}
      className={cn(
        "group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3fda8a]",
        active && "bg-black/[0.04]",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors group-hover:border-[#3fda8a]/50 group-hover:text-[#12784a]",
          active
            ? "border-[#3fda8a]/60 text-[#12784a]"
            : "border-black/[0.07] text-neutral-700",
        )}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-tight text-neutral-900">
          {item.title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-neutral-600">
          {item.description}
        </span>
      </span>
    </NavigationMenuLink>
  );
}

const triggerClass = cn(
  "h-9 rounded-lg bg-transparent px-3 text-[14px] font-medium text-neutral-700 shadow-none transition-colors",
  "hover:bg-black/[0.05] hover:text-neutral-900",
  "data-[state=open]:bg-black/[0.05] data-[state=open]:text-neutral-900",
);

/* -------------------------------------------------------------------------- */
/* Auth actions (shared by desktop + mobile)                                  */
/* -------------------------------------------------------------------------- */

function AuthActions({
  full = false,
  onNavigate,
}: {
  full?: boolean;
  onNavigate?: () => void;
}) {
  const trpc = useTRPC();
  // retry:false so signed-out visitors see "Sign in" immediately, not after 3 retries
  const { data: user, isPending } = useQuery(
    trpc.user.profile.queryOptions(undefined, { retry: false }),
  );

  if (isPending) {
    // reserve the space so the navbar doesn't jump
    return (
      <div className={cn("h-9", full ? "w-full" : "w-[200px]")} aria-hidden />
    );
  }

  if (user) {
    return (
      <Link
        href={ROUTES.dashboard}
        onClick={onNavigate}
        className={cn(
          "primary-btn rounded-lg",
          full && "block w-full text-center",
        )}
      >
        Dashboard
      </Link>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2.5", full && "grid grid-cols-2")}
    >
      <Link
        href={ROUTES.login}
        onClick={onNavigate}
        className="secondary-btn rounded-lg text-center"
      >
        Sign in
      </Link>
      <Link
        href={ROUTES.signup}
        onClick={onNavigate}
        className="primary-btn group rounded-lg"
      >
        Start for free
        {!full && (
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        )}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile accordion (CSS only)                                                */
/* -------------------------------------------------------------------------- */

function MobileGroup({
  title,
  groups,
  open,
  onToggle,
  onNavigate,
}: {
  title: string;
  groups: { label?: string; items: NavEntry[] }[];
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="border-b border-black/[0.07]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-between px-2 text-left text-[15px] font-semibold text-neutral-900"
      >
        {title}
        <ChevronDown
          size={16}
          className={cn(
            "text-neutral-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-3">
            {groups.map((group) => (
              <div key={group.label ?? title}>
                {group.label && (
                  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onNavigate}
                      tabIndex={open ? 0 : -1}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-black/[0.04]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.07] bg-white text-neutral-700">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-neutral-900">
                          {item.title}
                        </span>
                        <span className="block text-[13px] leading-snug text-neutral-600">
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-neutral-400"
                      />
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Navbar                                                                     */
/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState("");
  const [activeProduct, setActiveProduct] = useState(PRODUCT_ITEMS[0].id);
  const [activeSolution, setActiveSolution] = useState(SOLUTIONS[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>("Product");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenu("");
  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] w-full bg-[#faf9f5]/90 backdrop-blur-md transition-[border-color,box-shadow] duration-200",
        scrolled
          ? "border-b border-black/[0.08] shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          : "border-b border-transparent",
      )}
    >
      <a
        href="#main-content"
        className="absolute -top-24 left-5 z-50 rounded-lg bg-white p-3 text-sm font-semibold text-neutral-900 shadow-md focus:top-3"
      >
        Skip to content
      </a>

      <nav className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5 sm:pr-8">
        <div className="flex items-center gap-8">
          <BrandLogo />

          {/* Desktop menu */}
          <div className="hidden lg:block">
            <NavigationMenu
              value={menu}
              onValueChange={(value) => {
                const v = (value as string | null) ?? "";
                setMenu(v);
                if (v === "Product") setActiveProduct(PRODUCT_ITEMS[0].id);
                if (v === "Solutions") setActiveSolution(SOLUTIONS[0].id);
              }}
            >
              <NavigationMenuList className="gap-1">
                {/* Product */}
                <NavigationMenuItem value="Product">
                  <NavigationMenuTrigger className={triggerClass}>
                    Product
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[860px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_50px_-20px_rgba(20,22,16,0.25)]">
                      <div className="grid grid-cols-[1fr_300px]">
                        <div className="grid grid-cols-2 gap-x-2 p-4">
                          {PRODUCT_COLUMNS.map((column, ci) => (
                            <div key={ci} className="space-y-4">
                              {column.map((group) => (
                                <div key={group.label}>
                                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                                    {group.label}
                                  </p>
                                  {group.items.map((item) => (
                                    <NavItem
                                      key={item.id}
                                      item={item}
                                      active={activeProduct === item.id}
                                      onHover={() => setActiveProduct(item.id)}
                                      onNavigate={closeMenu}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>

                        <div className="border-l border-black/[0.06] bg-[#faf9f5] p-3">
                          <Preview
                            items={PRODUCT_ITEMS}
                            activeId={activeProduct}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-black/[0.06] px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] text-neutral-600">
                            Publishes to
                          </span>
                          <ChannelLogos size={20} />
                        </div>
                        <Link
                          href={ROUTES.platform}
                          onClick={closeMenu}
                          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-800 hover:text-[#12784a]"
                        >
                          See how it all fits together
                          <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Solutions */}
                <NavigationMenuItem value="Solutions">
                  <NavigationMenuTrigger className={triggerClass}>
                    Solutions
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid w-[700px] grid-cols-[1fr_300px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_50px_-20px_rgba(20,22,16,0.25)]">
                      <div className="p-4">
                        <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                          Who it&apos;s for
                        </p>
                        {SOLUTIONS.map((item) => (
                          <NavItem
                            key={item.id}
                            item={item}
                            active={activeProduct === item.id}
                            onHover={() => setActiveProduct(item.id)}
                            onNavigate={closeMenu}
                          />
                        ))}
                      </div>
                      <div className="border-l border-black/[0.06] bg-[#faf9f5] p-3">
                        <Preview items={SOLUTIONS} activeId={activeSolution} />
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Direct link */}
                <NavigationMenuItem>
                  <NavigationMenuLink
                    render={<Link href={ROUTES.pricing} />}
                    onClick={closeMenu}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-neutral-700 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
                  >
                    Pricing
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    render={<Link href={"/about"} />}
                    onClick={closeMenu}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-neutral-700 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
                  >
                    About
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden lg:block">
          <AuthActions />
        </div>

        {/* Mobile */}
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              type="button"
              aria-label="Open navigation menu"
              className="flex size-10 items-center justify-center rounded-lg border border-black/[0.1] bg-white text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              <Menu size={19} />
            </SheetTrigger>

            <SheetContent
              side="right"
              className="flex h-dvh w-full max-w-[380px] flex-col border-l border-black/[0.08] bg-[#faf9f5] p-0 sm:max-w-[380px]"
            >
              <SheetHeader className="border-b border-black/[0.07] px-5 py-4">
                <SheetTitle className="sr-only">Draftva navigation</SheetTitle>
                <BrandLogo />
              </SheetHeader>

              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-2">
                <MobileGroup
                  title="Product"
                  groups={PRODUCT_COLUMNS.flat()}
                  open={mobileGroup === "Product"}
                  onToggle={() =>
                    setMobileGroup(mobileGroup === "Product" ? null : "Product")
                  }
                  onNavigate={closeMobile}
                />
                <MobileGroup
                  title="Solutions"
                  groups={[{ items: SOLUTIONS }]}
                  open={mobileGroup === "Solutions"}
                  onToggle={() =>
                    setMobileGroup(
                      mobileGroup === "Solutions" ? null : "Solutions",
                    )
                  }
                  onNavigate={closeMobile}
                />
                <Link
                  href={ROUTES.pricing}
                  onClick={closeMobile}
                  className="flex h-12 items-center justify-between border-b border-black/[0.07] px-2 text-[15px] font-semibold text-neutral-900"
                >
                  Pricing
                  <ChevronRight size={15} className="text-neutral-400" />
                </Link>
              </div>

              <div className="space-y-3 border-t border-black/[0.07] bg-white p-4">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[13px] text-neutral-600">
                    Publishes to
                  </span>
                  <ChannelLogos size={20} />
                </div>
                <AuthActions full onNavigate={closeMobile} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
