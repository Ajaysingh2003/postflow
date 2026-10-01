"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock3, MessageSquare, Send, Users } from "lucide-react";

const steps = [
  {
    icon: Users,
    label: "Choose your lead list",
    note: "Founders · B2B software",
  },
  {
    icon: Send,
    label: "Send a personal introduction",
    note: "Hi Alex, enjoyed your post on…",
  },
  {
    icon: Clock3,
    label: "Give it a little time",
    note: "Wait 2 days · then follow up",
  },
  {
    icon: MessageSquare,
    label: "Start a conversation",
    note: "A reply. A real next step.",
  },
];
const captions: Record<string, string> = {
  prospects: "The right people. A relevant reason.",
  personalise: "An introduction with something to say.",
  sequences: "A little structure for your follow-through.",
  inbox: "Replies are where relationships begin.",
  analytics: "See which conversations move forward.",
};

export default function OutreachGraphic({
  kind,
  reduced,
}: {
  kind: string;
  reduced: boolean;
}) {
  const selected =
    (
      {
        prospects: 0,
        personalise: 1,
        sequences: 2,
        inbox: 3,
        analytics: 3,
      } as Record<string, number>
    )[kind] ?? 0;
  return (
    <div
      aria-hidden="true"
      className="relative flex min-h-80 flex-col overflow-hidden rounded-xl border border-[#dfedf5] bg-[#f0f7fb] px-5 py-6"
    >
      <div className="flex items-center justify-between text-[8px] font-medium tracking-[1.3px] text-slate-400">
        <span>OUTREACH / A WORKING PREVIEW</span>
        <span className="size-1.5 rounded-full bg-sky-400" />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={kind}
          initial={{ opacity: 0, y: reduced ? 0 : 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-6 mt-3 min-h-12 text-lg font-medium leading-snug tracking-tight"
        >
          {captions[kind] ?? captions.prospects}
        </motion.p>
      </AnimatePresence>
      <div className="relative space-y-4">
        <div className="absolute bottom-5 left-[17px] top-5 w-px bg-sky-200" />
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            className="relative flex items-center gap-3"
            animate={reduced ? {} : { opacity: [0.5, 1, 1, 0.5] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              delay: i * 0.7,
              times: [0, 0.2, 0.75, 1],
            }}
          >
            <span
              className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl border bg-white transition-colors ${selected === i ? "border-sky-300 text-sky-600 shadow-sm" : "border-slate-200 text-slate-400"}`}
            >
              <step.icon size={15} />
            </span>
            <div>
              <p className="text-[10px] font-medium text-slate-600">
                {step.label}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">{step.note}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="mt-6 rounded-lg border border-emerald-100 bg-white px-3 py-2.5"
        animate={
          reduced ? {} : { opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, 6] }
        }
        transition={{
          duration: 8,
          repeat: Infinity,
          times: [0, 0.4, 0.5, 0.9, 1],
        }}
      >
        <div className="flex items-center gap-1.5 text-[9px] font-medium text-emerald-600">
          <Check size={12} /> Alex replied
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          “Thanks for reaching out. Let’s talk.”
        </p>
      </motion.div>
    </div>
  );
}
