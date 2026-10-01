import Image from "next/image";
import { Star } from "lucide-react";


export function FeatureCardNormal() {
  return (
    <div className="hiddenz zlg:block w-full max-w-[540px] select-none pt-4">
      {/* 5-Star Rating */}
      
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className="size-4.5 fill-[#FFB800] text-[#FFB800]"
          />
        ))}
      </div>

      {/* Quote with Inline Highlighted Badges */}
      <p className="mt-3 font-heading text-[17px] font-medium leading-relaxed tracking-tight text-neutral-700">
        “We tried setting up AWS MediaConvert,{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-neutral-900 font-semibold">
          wrestled with FFmpeg
        </span>{" "}
        <span className="rounded-[5px] bg-[#dbeafe] px-1.5 py-0.5 text-neutral-900 font-semibold">
          and eventually gave up...
        </span>{" "}
        Rowley just works out of the box. Zero buffer lag and our transcode pipeline runs completely hands-free.”
      </p>

      {/* Author & Avatar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <Image
           unoptimized
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces&auto=format&q=80"
            alt="Jack Qi"
            width={40}
            height={40}
            className="size-full object-cover grayscale"
          />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold tracking-tight text-neutral-900">
            Jack Qi
          </p>
          <p className="font-subheading text-xs text-neutral-500">
            Co-Founder, Edcafe
          </p>
        </div>
      </div>

    </div>
  );
}