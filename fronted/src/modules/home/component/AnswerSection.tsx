import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ANSWER_PAGES, type AnswerPath } from "@/lib/seo/answers";

/** Native disclosure keeps every answer in server HTML and works without JS. */
export function AnswerSection({ path }: { path: AnswerPath }) {
  const page = ANSWER_PAGES[path];
  return (
    <section
      id="questions"
      aria-labelledby="questions-heading"
      className="mx-auto w-full max-w-4xl py-12 sm:py-20"
    >
      <h2
        id="questions-heading"
        className="font-heading text-2xl font-medium tracking-tight text-neutral-950 sm:text-3xl"
      >
        {page.heading}
      </h2>
      <div className="mt-8 space-y-3">
        {page.questions.map((item) => (
          <details
            key={item.id}
            id={item.id}
            className="group scroll-mt-24 overflow-hidden rounded-2xl border border-black/[0.08] bg-white open:border-[#188751]/30"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#188751] [&::-webkit-details-marker]:hidden">
              <h3 className="font-heading text-base font-semibold text-neutral-900">
                {item.question}
              </h3>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-neutral-500 motion-safe:transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="border-t border-black/[0.04] px-5 pb-5 pt-3 font-content text-sm leading-relaxed text-neutral-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
      <nav
        aria-label="Related resources"
        className="mt-6 flex flex-wrap gap-x-6 gap-y-3"
      >
        {page.related.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className="text-sm font-medium text-[#12784a] underline decoration-[#188751]/30 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#188751]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
