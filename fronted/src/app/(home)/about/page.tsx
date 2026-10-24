import type { Metadata } from "next";
import AboutView from "@/modules/home/view/AboutView";

export const metadata: Metadata = {
  title: "About Draftva | Independent, small, simple",
  description:
    "Meet the person behind Draftva and the ideas shaping a simpler way to write, schedule, and publish across social channels.",
};

export default function AboutPage() {
  return <AboutView />;
}
