import React, { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import ScheduleView from "@/modules/schedule/view/ScheduleView";
import ScheduleSkeleton from "@/modules/schedule/component/ScheduleSkeleton";
import { calendarRange } from "@/modules/schedule/calendarModel";

async function PreloadedSchedule() {
  const queryClient = getQueryClient();
  const range = calendarRange(new Date(), "week");
  await Promise.all([
    queryClient.prefetchQuery(trpc.studio.accounts.queryOptions()),
    queryClient.prefetchInfiniteQuery(
      trpc.studio.calendar.infiniteQueryOptions(
        {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
        {
          getNextPageParam: (page) => page.next_cursor ?? undefined,
        },
      ),
    ),
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ScheduleView />
    </HydrationBoundary>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <PreloadedSchedule />
    </Suspense>
  );
}