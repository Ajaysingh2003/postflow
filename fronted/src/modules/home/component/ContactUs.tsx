"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const CONTACT_ENDPOINT = "/api/contact";

const OUTREACH_VOLUMES = [
  { value: "under-500", label: "Under 500 connections / month" },
  { value: "500-2k", label: "500 to 2,000 connections / month" },
  { value: "2k-10k", label: "2,000 to 10,000 connections / month (Multi-profile)" },
  { value: "over-10k", label: "Agency scale (10,000+ connections / month)" },
];

const TRIAL_POINTS = [
  "14-day full feature trial",
  "Zero setup fee",
  "Account-safe rate limits",
];

const AUTOMATION_STEPS = [
  {
    icon: Users,
    tag: "TARGET",
    label: "Filter ICP Prospects",
    meta: "Filtered via Sales Nav",
  },
  {
    icon: Bot,
    tag: "AI ENRICH",
    label: "Analyze Recent Posts",
    meta: "Personalized context built",
  },
  {
    icon: UserPlus,
    tag: "CONNECT",
    label: "Smart Connection Note",
    meta: "Safe randomized delay",
  },
  {
    icon: MessageSquare,
    tag: "NURTURE",
    label: "Contextual Follow-up",
    meta: "Pauses automatically on reply",
  },
];

/* -------------------------------------------------------------------------- */
/* Main Section                                                               */
/* -------------------------------------------------------------------------- */

export default function ContactUs() {
  const reduce = useReducedMotion();
  const [modalOpen, setModalOpen] = useState(false);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <section
        id="contact"
        className="relative w-full overflow-hidden py-8 sm:py-16 lg:py-24 text-white"
      >
        <div className="mx-auto w-full">
          {/* ================================================================ */}
          {/* CTA Card (Electric Sky Blue to Deep Indigo Gradient)            */}
          {/* ================================================================ */}
          <div
            className="
              relative
              isolate
              flex
              flex-col
              overflow-hidden
              rounded-[28px]
              border
              border-sky-300/30
              bg-[radial-gradient(ellipse_120%_90%_at_50%_0%,#38bdf8_0%,#0284c7_45%,#0369a1_75%,#0c4a6e_100%)]
              shadow-[0_1px_3px_rgba(2,132,199,0.2),0_30px_60px_-25px_rgba(2,132,199,0.55)]
              sm:rounded-[36px]
              lg:rounded-[40px]
            "
          >
            {/* Ambient Lighting & Sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                background: `
                  radial-gradient(
                    65% 45% at 50% 0%,
                    rgba(255, 255, 255, 0.35),
                    rgba(255, 255, 255, 0) 70%
                  ),
                  linear-gradient(
                    to top,
                    rgba(12, 74, 110, 0.45),
                    rgba(12, 74, 110, 0) 40%
                  )
                `,
              }}
            />

            {/* Subtle Grid Pattern */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1] opacity-15"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
                `,
                backgroundSize: "48px 48px",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 30%, black 80%, transparent 100%)",
              }}
            />

            {/* ============================================================ */}
            {/* Copy                                                         */}
            {/* ============================================================ */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="
                relative
                z-10
                mx-auto
                flex
                max-w-[760px]
                flex-col
                items-center
                px-5
                pt-12
                text-center
                sm:px-8
                sm:pt-16
                lg:pt-20
              "
            >
              {/* Eyebrow */}
              <div
                className="
                  mb-5
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/25
                  bg-white/10
                  px-3.5
                  py-1.5
                  text-xs
                  font-medium
                  text-white
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]
                  backdrop-blur-md
                "
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-200 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                <Sparkles className="size-3.5 text-sky-200" />
                <span>Autonomous LinkedIn Pipeline</span>
              </div>

              {/* Heading */}
              <h2
                className="
                  text-balance
                  font-heading
                  text-[34px]
                  font-bold
                  leading-[1.05]
                  tracking-[-0.04em]
                  text-white
                  drop-shadow-xs
                  sm:text-[52px]
                  lg:text-[62px]
                "
              >
                Scale your outreach.
                <br />
                Never sound like a robot.
              </h2>

              {/* Description */}
              <p
                className="
                  mt-4
                  max-w-[560px]
                  text-[15px]
                  leading-relaxed
                  text-white/85
                  sm:mt-5
                  sm:text-[17px]
                "
              >
                Connect your accounts, define your ICP, and let our intelligent engine
                engage prospects, send contextual introductions, and book meetings on autopilot.
              </p>

              {/* Action Buttons */}
              <div
                className="
                  mt-7
                  flex
                  w-full
                  flex-col
                  items-stretch
                  justify-center
                  gap-3
                  sm:mt-8
                  sm:w-auto
                  sm:flex-row
                "
              >
                <Link
                  href="/register"
                  className="
                    flex
                    h-11
                    w-full
                    items-center
                    justify-center
                    rounded-xl
                    bg-white
                    px-7
                    font-heading
                    text-sm
                    font-semibold
                    text-[#0369a1]
                    shadow-lg
                    shadow-black/15
                    transition-all
                    hover:bg-neutral-100
                    hover:scale-[1.02]
                    active:scale-[0.98]
                    sm:w-auto
                  "
                >
                  Start free trial
                </Link>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="
                    flex
                    h-11
                    w-full
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/30
                    bg-black/25
                    px-6
                    font-heading
                    text-sm
                    font-semibold
                    text-white
                    shadow-xs
                    backdrop-blur-md
                    transition-all
                    hover:bg-black/35
                    hover:border-white/40
                    active:scale-[0.98]
                    cursor-pointer
                    sm:w-auto
                  "
                >
                  Talk to growth team
                </button>
              </div>

              {/* Feature Checklist */}
              <ul
                className="
                  mt-5
                  flex
                  flex-wrap
                  items-center
                  justify-center
                  gap-x-5
                  gap-y-2
                  text-xs
                  font-medium
                  text-white/90
                  sm:mt-6
                "
              >
                {TRIAL_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-1.5">
                    <Check
                      className="size-3.5 stroke-[2.5] text-sky-200"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* ============================================================ */}
            {/* Animated Interactive Flow Graphic                            */}
            {/* ============================================================ */}
            <div className="relative z-10 mx-auto mt-10 w-full max-w-4xl px-4 pb-14 sm:mt-12 sm:px-6">
              <div className="relative rounded-2xl border border-white/20 bg-black/20 p-4 backdrop-blur-xl shadow-2xl sm:p-6">
                
                {/* Visual Status Indicator */}
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                    </span>
                    <span>Live Sequence Engine</span>
                  </div>
                  <span className=" text-[11px] text-white/70">
                    4-Node Safe Automation
                  </span>
                </div>

                {/* Automation Steps Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {AUTOMATION_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={step.label}
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          delay: reduce ? 0 : idx * 0.12,
                          duration: 0.5,
                        }}
                        className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-white/10 p-3.5 transition-all hover:border-white/30 hover:bg-white/15"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-sky-400/25 px-1.5 py-0.5  text-[9px] font-bold text-sky-200">
                              {step.tag}
                            </span>
                            <span className="text-[10px]  text-white/50">
                              0{idx + 1}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                              <Icon className="size-4 text-sky-200" />
                            </div>
                            <span className="text-xs font-semibold leading-snug text-white">
                              {step.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[10px] text-white/70">
                          <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{step.meta}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Status Ribbon */}
            <div
              className="
                pointer-events-none
                absolute
                bottom-3
                left-1/2
                z-10
                flex
                -translate-x-1/2
                items-center
                gap-1.5
                whitespace-nowrap
                rounded-full
                border
                border-white/20
                bg-black/40
                px-3.5
                py-1.5
                text-[10px]
                font-semibold
                text-white
                shadow-lg
                backdrop-blur-md
                sm:bottom-4
                sm:gap-2
                sm:px-4
                sm:text-xs
              "
            >
              <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden="true" />
              <span>LinkedIn Voyager Human Simulation Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/* Contact Modal                                                          */}
      {/* ====================================================================== */}
      <AnimatePresence>
        {modalOpen && <ContactModal onClose={closeModal} />}
      </AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal Types & Components                                                   */
/* -------------------------------------------------------------------------- */

type FormState = {
  name: string;
  email: string;
  volume: string;
  message: string;
};

type Status = "idle" | "sending" | "sent" | "error";

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  volume: OUTREACH_VOLUMES[1].value,
  message: "",
};

const fieldClass = `
  w-full
  rounded-lg
  border
  border-black/15
  bg-neutral-50
  px-3
  text-sm
  text-neutral-900
  outline-none
  transition
  placeholder:text-neutral-400
  focus-visible:border-sky-500
  focus-visible:bg-white
  focus-visible:ring-2
  focus-visible:ring-sky-400/40
`;

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="
          mb-1.5
          flex
          items-baseline
          justify-between
          text-xs
          font-semibold
          text-neutral-700
        "
      >
        {label}
        {optional && (
          <span className="font-normal text-neutral-400">Optional</span>
        )}
      </label>
      {children}
    </div>
  );
}

function ContactModal({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>("idle");

  const update =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((current) => ({
        ...current,
        [key]: e.target.value,
      }));
    };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
        "input, select, textarea, button:not([disabled]), a[href]",
      );
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");

    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const titleId = `${uid}-title`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-end
        justify-center
        bg-black/50
        backdrop-blur-sm
        sm:items-center
        sm:p-4
      "
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : 12 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="
          relative
          max-h-[92dvh]
          w-full
          max-w-[460px]
          overflow-y-auto
          rounded-t-[24px]
          border
          border-black/10
          bg-white
          p-6
          shadow-2xl
          sm:rounded-[24px]
          sm:p-7
        "
      >
        {/* Accent Bar */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-400 to-[#0284c7]" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-5">
          <div>
            <h3
              id={titleId}
              className="font-heading text-lg font-bold tracking-tight text-neutral-950"
            >
              Talk to our growth strategists
            </h3>
            <p className="mt-1 max-w-[340px] text-xs leading-relaxed text-neutral-500">
              Tell us your target volume and goals. We will share safe playbook configurations.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              flex
              size-8
              shrink-0
              items-center
              justify-center
              rounded-full
              text-neutral-400
              transition
              hover:bg-neutral-100
              hover:text-neutral-900
            "
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form or Success View */}
        {status === "sent" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-sky-100 text-[#0284c7]">
              <Check className="size-5" aria-hidden="true" />
            </div>

            <h4 className="mt-4 text-sm font-semibold text-neutral-950">
              Message received
            </h4>

            <p className="mt-1 max-w-[300px] break-words text-xs leading-relaxed text-neutral-500">
              Our team will get back to {form.email} within 24 hours.
            </p>

            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="secondary-btn mt-6 h-10 rounded-xl px-5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field id={`${uid}-name`} label="Your name">
              <input
                ref={nameRef}
                id={`${uid}-name`}
                required
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={update("name")}
                placeholder="Alex Morgan"
                className={`${fieldClass} h-10`}
              />
            </Field>

            <Field id={`${uid}-email`} label="Work email">
              <input
                id={`${uid}-email`}
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update("email")}
                placeholder="alex@company.com"
                className={`${fieldClass} h-10`}
              />
            </Field>

            <Field id={`${uid}-scale`} label="Estimated Monthly Outreach">
              <select
                id={`${uid}-scale`}
                value={form.volume}
                onChange={update("volume")}
                className={`${fieldClass} h-10`}
              >
                {OUTREACH_VOLUMES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id={`${uid}-message`}
              label="What are you aiming to automate?"
              optional
            >
              <textarea
                id={`${uid}-message`}
                rows={4}
                value={form.message}
                onChange={update("message")}
                placeholder="e.g. Booking meetings for our B2B SaaS, recruiting talent, or warm founder outreach"
                className={`${fieldClass} resize-none py-2.5`}
              />
            </Field>

            {status === "error" && (
              <p role="alert" className="text-xs leading-5 text-red-600">
                Something went wrong. Please check your connection and try again.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="
                primary-btn
                mt-1
                h-11
                w-full
                justify-center
                rounded-xl
                font-semibold
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {status === "sending" ? "Sending…" : "Send message"}
              {status !== "sending" && (
                <Send className="size-3.5 ml-1.5" aria-hidden="true" />
              )}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}