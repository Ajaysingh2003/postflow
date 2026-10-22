import { Button } from "@/components/ui/button";
import React from "react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

function CtaSection() {
  const trpc = useTRPC();
  const { data: userData } = useSuspenseQuery(trpc.user.me.queryOptions());

  const router = useRouter();
  return (
    <div>
      {!userData ? (
        <div className="side_2 p-1   justify-centezr mt-5 flex items-center flex-col md:flex-row gap-5">
          <Button
            className=" h-9 capitalize secondary-btn w-full md:w-45 cursor-pointer border-[0.5px] border-[#0000009b] rounded-lg"
            variant={"ghost"}
            asChild
          >
            <Link href="/register">Sign up</Link>
          </Button>
          <Button
            variant={"default"}
            className="capitalize h-9 px-8 w-full md:w-45 rounded-md primary-btn font-bold  cursor-pointer text-white "
            asChild
          >
            <Link href="/register">Start for free</Link>
          </Button>
        </div>
      ) : (
        <div className="side_2 p-1   justify-centezr mt-5 flex items-center flex-col md:flex-row gap-5">
          <Button
            onClick={() => router.push(`dashboard/schedule`)}
            className=" h-9 capitalize secondary-btn w-full md:w-45 cursor-pointer border-[0.5px] border-[#0000009b] rounded-lg"
            variant={"ghost"}

          >
            Schedule
          </Button>
          <Button
          onClick={()=>router.push(`/dashboard`)}
            variant={"default"}
            className="capitalize h-9 px-8 w-full md:w-45 rounded-md primary-btn font-bold  cursor-pointer text-white "

          >
            Start for free
          </Button>
        </div>
      )}
    </div>
  );
}

export default CtaSection;
