import { AgentsSkeleton } from "@/modules/agents/AgentsDialog";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <AgentsSkeleton />
    </div>
  );
}
