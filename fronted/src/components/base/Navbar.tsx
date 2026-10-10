"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  GalleryHorizontalEnd,
  Menu,
  MessageCircle,
  Plug,
  Terminal,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import OutreachGraphic from "./OutreachGraphic";

import {
  products,
  solutions,
  outreach,
} from "@/modules/home/data/platform";

/* -------------------------------------------------------------------------- */
/* Interactive Graphics for Desktop Dropdowns                                 */
/* -------------------------------------------------------------------------- */

function MenuGraphic({ kind, reduced }: { kind: string; reduced: boolean }) {
  return (
    <div
      className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-xl border border-sky-100 bg-radial-[at_30%_30%] from-[#f6fbff] to-[#e7f3fa]"
      aria-hidden="true"
    >
      <div className="absolute left-5 top-4 size-[330px] rounded-full border border-sky-200/50" />
      <div className="absolute left-[65px] top-[60px] size-60 rounded-full border border-sky-200/50" />
      <AnimatePresence mode="wait">
        <motion.div
          key={kind}
          className="relative z-10 min-h-[201px] w-[210px] rounded-xl border border-sky-100 bg-white/95 p-[22px] shadow-[0_16px_30px_#35648515] xl:w-[228px] [&>strong]:my-[18px] [&>strong]:block [&>strong]:text-[17px] [&>strong]:font-medium [&>strong]:leading-snug [&>strong]:tracking-tight"
          initial={{
            opacity: 0,
            y: reduced ? 0 : 12,
            rotate: reduced ? 0 : -3,
          }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          transition={{ duration: 0.25 }}
        >
          <span className="flex items-center gap-2 text-[8px] font-semibold tracking-wider text-neutral-400">
            <span className="text-sky-500">
              <Workflow size={14} />
            </span>{" "}
            LINKEDIN WORKSPACE
          </span>
          {kind === "plan" ? (
            <>
              <strong>A little more consistent.</strong>
              <div className="grid grid-cols-7 gap-1 [&>span]:flex [&>span]:h-[22px] [&>span]:items-center [&>span]:justify-center [&>span]:rounded [&>span]:bg-neutral-100 [&>span]:text-[8px] [&>span]:text-neutral-500">
                {Array.from({ length: 14 }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0.2 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : i * 0.035 }}
                    className={
                      [2, 4, 8, 11].includes(i)
                        ? "bg-sky-100! text-sky-600! font-semibold"
                        : ""
                    }
                  >
                    {[2, 4, 8, 11].includes(i) ? <Check size={12} /> : i + 1}
                  </motion.span>
                ))}
              </div>
            </>
          ) : kind === "grow" ? (
            <>
              <strong>Find what resonates.</strong>
              <div className="flex h-[105px] items-end justify-between gap-2 [&>span]:flex-1 [&>span]:rounded-t [&>span]:bg-gradient-to-b [&>span]:from-sky-400 [&>span]:to-sky-100">
                {[28, 42, 36, 63, 54, 83, 100].map((h, i) => (
                  <motion.span
                    key={i}
                    initial={{ height: 8 }}
                    animate={{ height: h }}
                    transition={{
                      duration: reduced ? 0 : 0.5,
                      delay: reduced ? 0 : i * 0.05,
                    }}
                  />
                ))}
              </div>
            </>
          ) : kind === "slides" ? (
            <>
              <strong>One idea. A few good slides.</strong>
              <div className="relative mt-6 h-28">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-y-0 left-3 w-32 rounded-lg border border-sky-200 bg-white p-4 shadow-sm"
                    animate={{ x: i * 16, rotate: (i - 1) * 7 }}
                    transition={{ duration: reduced ? 0 : 0.5 }}
                  >
                    <span className="text-[8px] font-semibold text-sky-500">
                      0{i + 1} / STORY
                    </span>
                    <div className="mt-4 h-2 w-16 rounded bg-sky-100" />
                    <div className="mt-2 h-1 w-20 rounded bg-neutral-100" />
                  </motion.div>
                ))}
              </div>
            </>
          ) : ["connect", "engage", "automate", "mcp", "playbooks"].includes(kind) ? (
            <>
              <strong>
                {kind === "playbooks"
                  ? "Your next steps, mapped out."
                  : kind === "mcp"
                  ? "Connected to your workflow."
                  : kind === "engage"
                  ? "Keep the conversation going."
                  : kind === "connect"
                  ? "A connection worth making."
                  : "A thoughtful next step."}
              </strong>
              <div className="space-y-2">
                {(kind === "playbooks"
                  ? ["Plan your week", "Welcome a connection", "Follow up thoughtfully"]
                  : kind === "mcp"
                  ? ["Your AI assistant", "Outlify · MCP", "Your LinkedIn workflow"]
                  : kind === "engage"
                  ? ["Find a relevant post", "Add your perspective", "Continue the conversation"]
                  : kind === "connect"
                  ? ["Find the right people", "A personal introduction", "Make time to follow up"]
                  : ["Connection accepted", "Wait for your chosen time", "Send your follow-up"]
                ).map((label, i) => (
                  <motion.div
                    key={label}
                    className="flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-2 text-[9px] text-neutral-600"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduced ? 0 : i * 0.15 }}
                  >
                    <span className="flex size-4 items-center justify-center rounded bg-sky-100 text-[8px] font-semibold text-sky-600">
                      {i + 1}
                    </span>
                    {label}
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <strong>
                {kind === "builder"
                  ? "An idea, built your way."
                  : "Sounds like you. Only clearer."}
              </strong>
              <div className="flex flex-col gap-2 [&>span]:h-[5px] [&>span]:rounded-sm [&>span]:bg-sky-100 [&>span:first-child]:bg-sky-300">
                {[95, 85, 100, 62].map((width, i) => (
                  <motion.span
                    key={i}
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{
                      duration: reduced ? 0 : 0.55,
                      delay: reduced ? 0 : i * 0.12,
                    }}
                  />
                ))}
              </div>
              <span className="mt-[18px] inline-block rounded bg-sky-50 px-2 py-1 text-[8px] font-medium text-sky-700">
                {kind === "builder" ? "Topic. Tone. Your next post." : "Your voice, first"}
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <motion.div
        className="absolute right-3 top-[38px] z-20 flex size-[43px] items-center justify-center rounded-xl bg-gradient-to-b from-[#4ab3f6] to-[#178ee0] text-white shadow-[inset_0_1px_1px_#ffffff88,0_6px_12px_#218bd32b]"
        animate={reduced ? {} : { y: [0, -6, 0], rotate: [4, 0, 4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {kind === "mcp" ? (
          <Plug size={20} />
        ) : kind === "slides" ? (
          <GalleryHorizontalEnd size={20} />
        ) : (
          <Workflow size={20} />
        )}
      </motion.div>
      <div className="absolute bottom-[18px] text-[9px] font-medium text-neutral-400">
        Create. Publish. Connect. Grow.
      </div>
    </div>
  );
}

function SolutionsGraphic({
  kind,
  reduced,
}: {
  kind: string;
  reduced: boolean;
}) {
  const audiences: Record<
    string,
    { title: string; center: string; people: string[]; result: string }
  > = {
    founders: {
      title: "Build around your business.",
      center: "You",
      people: ["Customers", "Peers", "Partners"],
      result: "Relationships that grow with you",
    },
    creators: {
      title: "Let your expertise travel.",
      center: "Your voice",
      people: ["Readers", "Clients", "Community"],
      result: "Content that starts conversations",
    },
    sales: {
      title: "A warmer way to connect.",
      center: "Your team",
      people: ["Prospects", "Replies", "Follow-ups"],
      result: "From first contact to real dialogue",
    },
    agencies: {
      title: "Make room for every client.",
      center: "Your agency",
      people: ["Client A", "Client B", "Client C"],
      result: "A consistent presence, together",
    },
  };
  const audience = audiences[kind] ?? audiences.founders;

  return (
    <div
      aria-hidden="true"
      className="relative flex min-h-80 flex-col justify-center overflow-hidden rounded-xl border border-sky-100 bg-[#f0f7fb] px-5 py-7"
    >
      <span className="text-[8px] font-bold tracking-wider text-sky-800/60 uppercase">
        PEOPLE AT THE CENTRE
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={kind}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="mt-3 text-[19px] font-semibold leading-snug tracking-tight text-neutral-900">
            {audience.title}
          </h3>
          <div className="relative my-6 flex flex-col items-center">
            <div className="z-10 flex h-12 min-w-28 items-center justify-center rounded-xl border border-sky-200 bg-white px-4 text-[11px] font-semibold text-sky-700 shadow-xs">
              {audience.center}
            </div>
            <svg
              className="h-12 w-full text-sky-200"
              viewBox="0 0 240 48"
              fill="none"
            >
              <path
                d="M120 0V20M40 48V20H200V48M120 20V48"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {[40, 120, 200].map((x, i) => (
                <motion.circle
                  key={x}
                  cx={x}
                  cy={32}
                  r={2.5}
                  fill="#2599e2"
                  animate={reduced ? {} : { cy: [23, 44], opacity: [0, 1, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.35,
                  }}
                />
              ))}
            </svg>
            <div className="grid w-full grid-cols-3 gap-2">
              {audience.people.map((person, i) => (
                <motion.div
                  key={person}
                  className="rounded-lg border border-sky-100 bg-white px-1 py-3 text-center text-[8px] font-medium text-neutral-600"
                  animate={reduced ? {} : { y: [0, -3, 0] }}
                  transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }}
                >
                  <span className="mx-auto mb-2 flex size-6 items-center justify-center rounded-full bg-neutral-100 text-[8px] font-semibold text-neutral-600">
                    {person.slice(0, 1)}
                  </span>
                  {person}
                </motion.div>
              ))}
            </div>
          </div>
          <p className="text-center text-[10px] leading-relaxed text-neutral-400">
            {audience.result}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Submenu Item Card                                                          */
/* -------------------------------------------------------------------------- */

function NavItemCard({
  title,
  description,
  href,
  icon: Icon,
  onHover,
  onClick,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <NavigationMenuLink >
      <Link
        href={href}
        onMouseEnter={onHover}
        onFocus={onHover}
        onClick={onClick}
        className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-neutral-100/70 focus:bg-neutral-100/70 focus:outline-none"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-neutral-500 shadow-2xs transition-all group-hover:border-black/[0.12] group-hover:text-neutral-900 group-hover:shadow-xs">
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="font-heading text-xs font-semibold text-neutral-900">
              {title}
            </p>
            <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 text-neutral-400" />
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 line-clamp-2">
            {description}
          </p>
        </div>
      </Link>
    </NavigationMenuLink>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Navbar Component                                                      */
/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [active, setActive] = useState("write");
  const reduced = !!useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] w-full transition-all duration-300 ease-out",
        scrolled
          ? "border-b border-black/[0.06] bg-[#faf9f5]/85 shadow-[0_8px_30px_-15px_rgba(20,22,16,0.08)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <a
        className="absolute -top-24 left-5 z-50 rounded-lg bg-white p-3 font-semibold text-neutral-900 shadow-md transition-all focus:top-3"
        href="#main-content"
      >
        Skip to content
      </a>

      <nav className="mx-auto flex h-[55px] w-full max-w-[1240px] items-center justify-between px-5 sm:px-8">
        {/* ================================================================= */}
        {/* Brand & Desktop Links                                             */}
        {/* ================================================================= */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center text-[22px] font-extrabold tracking-[-1px] text-neutral-950"
            aria-label="Outlify home"
          >
            <span className="mr-2 flex size-8 items-center justify-center rounded-xl bg-gradient-to-b from-[#40aff6] to-[#158fe1] text-white shadow-[inset_0_1px_1px_#ffffff99,0_2px_4px_#168fe233]">
              <ArrowUpRight size={19} strokeWidth={2.5} />
            </span>
            outlify<span className="text-[#178fe2]">.</span>
          </Link>

          {/* Desktop Navigation Menu */}
          <div className="hidden lg:block">
            <NavigationMenu
              value={menu}
              onValueChange={(val) => {
                setMenu(val);
                setActive(
                  val === "Solutions"
                    ? "founders"
                    : val === "Outreach"
                    ? "prospects"
                    : "write"
                );
              }}
            >
              <NavigationMenuList className="gap-1">
                {/* Product Dropdown */}
                <NavigationMenuItem value="Product">
                  <NavigationMenuTrigger className="h-9 rounded-lg bg-transparent px-3 text-[13px] font-medium text-neutral-600 shadow-none hover:bg-black/[0.04] hover:text-neutral-900 data-[state=open]:bg-black/[0.04] data-[state=open]:text-neutral-900">
                    Product
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[880px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_24px_60px_-15px_rgba(20,22,16,0.16)]">
                      <div className="grid grid-cols-[1fr_270px]">
                        <div className="p-4">
                          <span className="mb-2 block px-2.5  text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                            YOUR COMPLETE LINKEDIN WORKSPACE
                          </span>
                          <div className="grid grid-cols-2 gap-1">
                            {products.map((item) => (
                              <NavItemCard
                                key={item.title}
                                {...item}
                                onHover={() => setActive(item.kind)}
                                onClick={() => setMenu(null)}
                              />
                            ))}
                          </div>
                          <div className="mt-4 border-t border-black/[0.06] pt-3">
                            <Link
                              href="#platform"
                              onClick={() => setMenu(null)}
                              className="group inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
                            >
                              <span>Explore the full platform</span>
                              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </div>
                        </div>

                        <div className="border-l border-black/[0.06] bg-[#fbfbf9] p-3">
                          <MenuGraphic kind={active} reduced={reduced} />
                        </div>
                      </div>

                      {/* Submenu Footer */}
                      <div className="flex items-center justify-between border-t border-black/[0.06] bg-neutral-50 px-4 py-2.5 text-[11px] text-neutral-500">
                        <div className="flex items-center gap-2">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                          </span>
                          <span>LinkedIn API & MCP Sync operational</span>
                        </div>
                        <span className=" text-[10px] text-neutral-400">
                          Automated & Safe Outbound
                        </span>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Solutions Dropdown */}
                <NavigationMenuItem value="Solutions">
                  <NavigationMenuTrigger className="h-9 rounded-lg bg-transparent px-3 text-[13px] font-medium text-neutral-600 shadow-none hover:bg-black/[0.04] hover:text-neutral-900 data-[state=open]:bg-black/[0.04] data-[state=open]:text-neutral-900">
                    Solutions
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[740px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_24px_60px_-15px_rgba(20,22,16,0.16)]">
                      <div className="grid grid-cols-[1fr_260px] gap-4">
                        <div>
                          <span className="mb-2 block px-2.5  text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                            A VOICE FOR EVERY AMBITION
                          </span>
                          <div className="flex flex-col gap-1">
                            {solutions.map((item) => (
                              <NavItemCard
                                key={item.title}
                                {...item}
                                onHover={() => setActive(item.kind)}
                                onClick={() => setMenu(null)}
                              />
                            ))}
                          </div>
                        </div>

                        <SolutionsGraphic kind={active} reduced={reduced} />
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Outreach Dropdown */}
                <NavigationMenuItem value="Outreach">
                  <NavigationMenuTrigger className="h-9 rounded-lg bg-transparent px-3 text-[13px] font-medium text-neutral-600 shadow-none hover:bg-black/[0.04] hover:text-neutral-900 data-[state=open]:bg-black/[0.04] data-[state=open]:text-neutral-900">
                    Outreach
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[760px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_24px_60px_-15px_rgba(20,22,16,0.16)]">
                      <div className="grid grid-cols-[1fr_260px] gap-4">
                        <div>
                          <span className="mb-2 block px-2.5  text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                            FROM FIRST CONTACT TO DIALOGUE
                          </span>
                          <div className="flex flex-col gap-1">
                            {outreach.map((item) => (
                              <NavItemCard
                                key={item.title}
                                {...item}
                                onHover={() => setActive(item.kind)}
                                onClick={() => setMenu(null)}
                              />
                            ))}
                          </div>
                        </div>

                        <OutreachGraphic kind={active} reduced={reduced} />
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Static Direct Links */}
                <NavigationMenuItem>
                  <NavigationMenuLink >
                    <Link
                      href="#feature-mcp"
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-neutral-900"
                    >
                      Integrations
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink >
                    <Link
                      href="#how-it-works"
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-neutral-900"
                    >
                      How it works
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Right CTA Actions                                                 */}
        {/* ================================================================= */}
        <div className="hidden items-center gap-3 lg:flex">
          <Button
            
            className="secondary-btn h-9 rounded-xl px-3.5 text-xs font-semibold"
          >
            <Link href="/login">Sign in</Link>
          </Button>

          <Button
            
            className="primary-btn group h-9 rounded-xl px-4 text-xs font-bold text-white shadow-2xs transition-all active:scale-[0.98]"
          >
            <Link className="flex items-center" href="/login">
              <span>Start Free</span>
              <ArrowRight className="ml-1.5 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        {/* ================================================================= */}
        {/* Mobile Navigation Drawer                                          */}
        {/* ================================================================= */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet>
            <SheetTrigger >
              <button
                aria-label="Open mobile navigation menu"
                className="flex size-9.5 items-center justify-center rounded-xl border border-black/[0.08] bg-white/80 text-neutral-800 shadow-2xs backdrop-blur-md transition-colors hover:bg-white active:scale-95"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-full max-w-[380px] border-l border-black/[0.08] bg-[#faf9f5] p-0 shadow-2xl"
            >
              <SheetHeader className="flex flex-row items-center justify-between border-b border-black/[0.06] bg-white/70 px-5 py-4 backdrop-blur-md">
                <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
                <Link href="/" className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-b from-[#40aff6] to-[#158fe1] text-white">
                    <ArrowUpRight size={17} strokeWidth={2.5} />
                  </span>
                  <span className="font-heading text-base font-bold text-neutral-950">
                    outlify<span className="text-[#178fe2]">.</span>
                  </span>
                </Link>
              </SheetHeader>

              <div className="flex h-[calc(100dvh-65px)] flex-col justify-between">
                <div className="flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <MobileNavGroup title="Product" items={products} />
                  <MobileNavGroup title="Solutions" items={solutions} />
                  <MobileNavGroup title="Outreach" items={outreach} />

                  <div className="mt-4 border-t border-black/[0.06] pt-3">
                    <SheetClose >
                      <Link
                        href="#feature-mcp"
                        className="flex h-10 items-center justify-between rounded-xl px-2.5 text-xs font-semibold text-neutral-800 hover:bg-black/[0.035]"
                      >
                        <span>Integrations</span>
                        <ChevronRight className="size-4 text-neutral-400" />
                      </Link>
                    </SheetClose>
                    <SheetClose >
                      <Link
                        href="#how-it-works"
                        className="flex h-10 items-center justify-between rounded-xl px-2.5 text-xs font-semibold text-neutral-800 hover:bg-black/[0.035]"
                      >
                        <span>How it works</span>
                        <ChevronRight className="size-4 text-neutral-400" />
                      </Link>
                    </SheetClose>
                  </div>
                </div>

                <div className="border-t border-black/[0.06] bg-white/80 p-4 backdrop-blur-md">
                  <div className="grid grid-cols-2 gap-2.5">
                    <SheetClose >
                      <Button
                        
                        className="secondary-btn h-11 rounded-xl text-sm font-semibold"
                      >
                        <Link href="/login">Sign in</Link>
                      </Button>
                    </SheetClose>

                    <SheetClose >
                      <Button
                        
                        className="primary-btn h-11 rounded-xl text-sm font-semibold text-white shadow-xs"
                      >
                        <Link href="/login">Start Free</Link>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile Nav Group Helper                                                    */
/* -------------------------------------------------------------------------- */

function MobileNavGroup({
  title,
  items,
}: {
  title: string;
  items: {
    title: string;
    description: string;
    href: string;
    icon: React.ElementType;
  }[];
}) {
  return (
    <div className="mb-5 w-full">
      <p className="mb-2 px-2.5  text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {title}
      </p>

      <div className="flex w-full flex-col space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            /* asChild ensures SheetClose forwards its props directly to Link, avoiding inline button wrapping */
            <SheetClose key={item.title} >
              <Link
                href={item.href}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-black/[0.035] active:bg-black/[0.05]"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-neutral-600 shadow-2xs">
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <p className="font-heading text-xs font-semibold text-neutral-900">
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {item.description}
                  </p>
                </div>

                <ChevronRight className="size-3.5 shrink-0 text-neutral-400" />
              </Link>
            </SheetClose>
          );
        })}
      </div>
    </div>
  );
}