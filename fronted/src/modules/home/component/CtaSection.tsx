import { Button } from "@/components/ui/button";
import React from "react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

function CtaSection() {
  const trpc = useTRPC();
  const { data: userData } = useQuery(trpc.user.profile.queryOptions());

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
            asChild
            className=" h-9 capitalize secondary-btn w-full md:w-45 cursor-pointer border-[0.5px] border-[#0000009b] rounded-lg"
            variant={"ghost"}
          >
            <Link href="/dashboard/schedule">Schedule</Link>
          </Button>
          <Button
            asChild
            variant={"default"}
            className="capitalize h-9 px-8 w-full md:w-45 rounded-md primary-btn font-bold  cursor-pointer text-white "
          >
            <Link href="/dashboard">Start for free</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default CtaSection;
