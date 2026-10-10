import React from "react";
import { ReviewCard } from "./ReviewCard";

const REVIEWS = [
  {
    id: "review-1",
    photo:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
    name: "Jack Qi",
    role: "Co-Founder, Edcafe",
    review: (
      <p className="mt-3 font-heading text-[17px] font-medium leading-relaxed tracking-tight text-neutral-700">
        “I used to write a post on LinkedIn, then{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 font-semibold text-neutral-900">
          rewrite it for X
        </span>{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 font-semibold text-neutral-900">
          and again for Threads.
        </span>{" "}
        Now I write it once in Draftva, tweak each version side by side, and
        schedule the whole week in one sitting.”
      </p>
    ),
  },
  {
    id: "review-2",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
    name: "Marcus Vance",
    role: "Founder, HyperCourse",
    review: (
      <p className="mt-3 font-heading text-[17px] font-medium leading-relaxed tracking-tight text-neutral-700">
        “I stopped posting only when I felt inspired. Draftva keeps my ideas in
        one place and{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 font-semibold text-neutral-900">
          my queue is never empty
        </span>
        . The analytics show which posts actually{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 font-semibold text-neutral-900">
          bring in followers
        </span>
        , so I know what to write next.”
      </p>
    ),
  },
];

export default function ReviewSection() {
  return (
    <section className="mx-auto w-full max-w-6xl py-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {REVIEWS.map(({ id, photo, review, name, role }) => (
          <ReviewCard
            key={id}
            photo={photo}
            review={review}
            name={name}
            role={role}
          />
        ))}
      </div>
    </section>
  );
}