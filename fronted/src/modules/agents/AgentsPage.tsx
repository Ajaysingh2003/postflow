"use client";

import { useRouter } from "next/navigation";
import AgentsDialog from "./AgentsDialog";

export default function AgentsPage() {
  const router = useRouter();
  return (
    <>
      <div className="p-8">
        <h1 className="font-heading text-2xl">Agents & integrations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect your favorite AI assistant to Draftva.
        </p>
      </div>
      <AgentsDialog
        open
        onOpenChange={(open) => {
          if (!open) router.replace("/dashboard");
        }}
      />
    </>
  );
}
