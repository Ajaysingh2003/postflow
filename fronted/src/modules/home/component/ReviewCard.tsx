import Image from "next/image";
import { Star } from "lucide-react";
import { ReactNode } from "react";


export function ReviewCard({review,photo,name,role}:{review:ReactNode,photo:string,name:string,role:string}) {
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
      {review}

      {/* Author & Avatar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <Image
           unoptimized
            src={photo}
            alt="Jack Qi"
            width={40}
            height={40}
            className="size-full object-cover grayscale"
          />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold tracking-tight text-neutral-900">
            {name}
          </p>
          <p className="font-subheading text-xs text-neutral-500">
            {role}
          </p>
        </div>
      </div>

    </div>
  );
}