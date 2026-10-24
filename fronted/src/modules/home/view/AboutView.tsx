import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Feather,
  Layers,
  Sparkles,
  Mail,
  CheckCircle2,
} from "lucide-react";
import FinalCta from "../component/FinalCta";

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

const NETWORKS = {
  x: { label: "X", icon: "/channels/x.jpeg" },
  linkedin: { label: "LinkedIn", icon: "/channels/linkedin.svg" },
  instagram: { label: "Instagram", icon: "/channels/instagram.svg" },
} as const;

type Network = keyof typeof NETWORKS;

const team: {
  name: string;
  role: string;
  bio: string;
  image: string;
  alt: string;
  links: Partial<Record<Network, string>>;
}[] = [
  {
    name: "Ajay Singh",
    role: "Founder & Product Architect",
    bio: "Building calm, focused software for creators and founders who care about their craft.",
    image: "/founder.png",
    alt: "Illustrated portrait of Ajay Singh",
    // TODO: add your profile URLs. Icons only render for links you fill in.
    links: {
      // x: "https://x.com/yourhandle",
      // linkedin: "https://linkedin.com/in/yourname",
      // instagram: "https://instagram.com/yourhandle",
    },
  },
];

/** TODO: add photos to /public/about and list them here. The section hides itself when empty. */
const photos: { src: string; alt: string }[] = [
  // { src: "/about/sketching.jpg", alt: "Sketching out Draftva" },
  // { src: "/about/desk.jpg", alt: "Where Draftva gets built" },
];
const photoCaption = "Sketching out Draftva.";

const workflowSteps = [
  {
    step: "01",
    label: "Capture the spark",
    detail: "Drop a messy voice note, bullet list, or half-formed thought.",
  },
  {
    step: "02",
    label: "Shape in your voice",
    detail: "Refine with AI trained on your tone—never generic templates.",
  },
  {
    step: "03",
    label: "Tailor & schedule",
    detail: "Adapt for X, LinkedIn, and Instagram in one calm queue.",
  },
];

const principles = [
  {
    number: "01",
    icon: Feather,
    title: "Your voice comes first.",
    description:
      "AI should help you express an idea, not replace your point of view. Your tone, writing samples, and feedback guide the draft. You decide what goes out.",
  },
  {
    number: "02",
    icon: Layers,
    title: "Less switching. More creating.",
    description:
      "Ideas, drafts, connected channels, and your publishing schedule belong together. Keep the work in one place, with room to tailor each post to its platform.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Make the everyday feel simple.",
    description:
      "A useful tool should be easy to come back to. Clear actions, thoughtful details, and a straightforward path from a rough thought to a published post.",
  },
];

/* -------------------------------------------------------------------------- */
/* Decoration                                                                 */
/* -------------------------------------------------------------------------- */

/** Decorative double-ring arcs in the top-left and right margins, strictly behind content. */
function HeroRings() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Top-left double ring */}
      <div
        className="
          absolute
          top-[-140px]
          -left-[420px]
          h-[760px]
          w-[760px]
          rounded-full
          border-[24px]
          border-[#ebeae5]/70
        "
      />
      <div
        className="
          absolute
          top-[-110px]
          -left-[390px]
          h-[700px]
          w-[700px]
          rounded-full
          border
          border-[#deddd7]/60
        "
      />

      {/* Right-side double ring */}
      <div
        className="
          absolute
          top-[390px]
          -right-[520px]
          h-[930px]
          w-[930px]
          rounded-full
          border-[22px]
          border-[#ebeae5]/70
        "
      />
      <div
        className="
          absolute
          top-[430px]
          -right-[470px]
          h-[840px]
          w-[840px]
          rounded-full
          border
          border-[#deddd7]/60
        "
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const prose =
  "space-y-6 text-[17px] leading-[1.8] text-neutral-600 text-pretty";

export default function AboutView() {
  return (
    <div className="relative isolate overflow-x-clip selection:bg-[#188751]/15 selection:text-[#12784a]">
      <HeroRings />

      <article
        aria-labelledby="about-heading"
        className="relative z-10 mx-auto w-full max-w-[1040px] px-6 pt-32 pb-28 text-neutral-900 sm:pt-44 sm:pb-36"
      >
        {/* ------------------------------------------------------------------ */}
        {/* Hero Header                                                        */}
        {/* ------------------------------------------------------------------ */}
        <header className="mx-auto max-w-[720px] text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 text-xs font-medium tracking-wide text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#188751]" />
            Our Story &amp; Philosophy
          </div>

          <h1
            id="about-heading"
            className="font-heading text-[clamp(2.65rem,6.5vw,3.2rem)] leading-[1.04] font-medium tracking-[-0.04em] text-balance text-neutral-950"
          >
            Built small,{" "}
            <span className="font-normal text-[#188751] italic sm:font-medium sm:not-italic">
              on purpose.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-[560px] text-lg leading-relaxed text-neutral-600 text-pretty sm:text-[19px] sm:leading-8">
            A quieter place to turn your ideas into posts. Built for people
            growing something of their own, one thoughtful post at a time.
          </p>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Editorial Split: Founder Card + Manifesto Story                    */}
        {/* ------------------------------------------------------------------ */}
        <section
          aria-labelledby="story-heading"
          className="mt-20 grid grid-cols-1 items-start gap-12 border-t border-black/[0.08] pt-16 sm:mt-24 lg:grid-cols-[280px_1fr] lg:gap-16"
        >
          {/* Left Column: Founder Profile Card */}
          <aside aria-label="Team" className="lg:sticky lg:top-28">
            {team.map((member) => {
              const activeLinks = (Object.keys(NETWORKS) as Network[]).filter(
                (net) => Boolean(member.links[net])
              );

              return (
                <div
                  key={member.name}
                  className="mx-auto max-w-[280px] rounded-2xl border border-black/[0.08] bg-white/70 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-xs lg:mx-0"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-black/[0.06] bg-[#f6f1e6]">
                    <Image
                      src={member.image}
                      alt={member.alt}
                      fill
                      sizes="260px"
                      className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                    />
                  </div>

                  <div className="mt-4 px-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-semibold tracking-tight text-neutral-900">
                        {member.name}
                      </p>
                      <span className="rounded-full bg-[#188751]/10 px-2 py-0.5 text-[11px] font-medium text-[#12784a]">
                        Solo-built
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-neutral-500">
                      {member.role}
                    </p>
                    <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
                      {member.bio}
                    </p>

                    {activeLinks.length > 0 && (
                      <div className="mt-4 flex items-center gap-3 border-t border-black/[0.06] pt-3">
                        {activeLinks.map((net) => {
                          const href = member.links[net]!;
                          const { label, icon } = NETWORKS[net];
                          return (
                            <a
                              key={net}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${member.name} on ${label}`}
                              className="opacity-65 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#188751]"
                            >
                              <Image
                                src={icon}
                                alt=""
                                width={32}
                                height={32}
                                unoptimized={icon.endsWith(".svg")}
                                className="size-4 rounded-[4px] object-cover"
                              />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </aside>

          {/* Right Column: Narrative & Workflow */}
          <div>
            <h2
              id="story-heading"
              className="text-xs font-semibold tracking-[0.16em] text-[#188751] uppercase"
            >
              Why we built Draftva
            </h2>

            {/* Editorial Pull Quote */}
            <p className="mt-4 font-heading text-2xl leading-[1.3] font-medium tracking-tight text-neutral-900 text-balance sm:text-[28px]">
              There is a lot of friction between having a sharp idea and
              actually sharing it with the world.
            </p>

            <div className={cn2(prose, "mt-6")}>
              <p>
                Finding the right words, adapting the format for different
                platforms, and carving out time to publish often turns a
                five-minute thought into an hour of tab-switching. Most social
                tools only make this noisier—bloated with enterprise approval
                chains or generic AI prompts that flatten your personality.
              </p>
              <p className="font-medium text-neutral-900">
                Draftva brings those steps into one calm, opinionated workspace.
              </p>
            </div>

            {/* Optional Behind-the-Scenes Photos */}
            {photos.length > 0 && (
              <figure className="my-12">
                <div className="grid gap-4 sm:grid-cols-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.src}
                      className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/[0.07] bg-neutral-100 shadow-xs"
                    >
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(min-width: 640px) 340px, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
                <figcaption className="mt-3 text-center text-xs text-neutral-500">
                  {photoCaption}
                </figcaption>
              </figure>
            )}

            {/* Visual 3-Step Workflow Strip */}
            <div className="my-10 rounded-2xl border border-black/[0.08] bg-[#faf8f4] p-5 sm:p-6">
              <div className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                How the workspace flows
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {workflowSteps.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <span className="font-mono text-xs font-semibold text-[#188751]">
                      {item.step}
                    </span>
                    <h3 className="mt-1.5 text-sm font-semibold text-neutral-900">
                      {item.label}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={prose}>
              <p>
                Start with a rough note. Work with the AI assistant to shape it
                in your voice, tailor it for each channel, and choose when it
                goes live. Your drafts stay yours to review and refine.
              </p>
              <p>
                The goal is simple: make showing up feel manageable, so you can
                spend more time on the work and ideas you actually care about.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Principles Bento Cards                                             */}
        {/* ------------------------------------------------------------------ */}
        <section
          aria-labelledby="principles-heading"
          className="mt-24 border-t border-black/[0.08] pt-16 sm:mt-32 sm:pt-20"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[#188751] uppercase">
                Principles
              </p>
              <h2
                id="principles-heading"
                className="mt-2 font-heading text-2xl font-medium tracking-tight text-neutral-950 sm:text-3xl"
              >
                What matters here
              </h2>
            </div>
            <p className="max-w-sm text-sm text-neutral-500">
              Every feature in Draftva is filtered through three simple rules.
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <li
                  key={p.title}
                  className="group relative flex flex-col justify-between rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#188751]/30 hover:shadow-[0_12px_30px_rgba(24,135,81,0.06)]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-[#188751]/15 bg-[#188751]/[0.07] text-[#188751]">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-xs font-medium text-neutral-400">
                        {p.number}
                      </span>
                    </div>

                    <h3 className="mt-6 text-lg font-semibold tracking-tight text-neutral-900 text-balance">
                      {p.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-neutral-600 text-pretty">
                      {p.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-1.5 border-t border-black/[0.05] pt-4 text-xs font-medium text-neutral-500">
                    <CheckCircle2 className="size-3.5 text-[#188751]" />
                    <span>Core product standard</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Closing Call-To-Action Card                                        */}
        {/* ------------------------------------------------------------------ */}
        <FinalCta/>
      </article>
    </div>
  );
}

/** tiny local class joiner so this server component needs no extra imports */
function cn2(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}