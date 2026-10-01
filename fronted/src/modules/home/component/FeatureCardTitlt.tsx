import { ShieldCheck, Stars, WandSparklesIcon } from "lucide-react";
import React from "react";
import { BentoHeader } from "./FeatureSection";

function FeatureCardTilt() {
  return (
    <div className="flex  items-start bg-white shadow-md    rounded-md rotate-2 justify-end px-2 py-3 sm:px-3">
      <BentoHeader
        icon={ShieldCheck}
        badge="DRM & Security"
        title="Zero-leak video protection"
        description="Enforce ephemeral playback tokens, dynamic forensic watermarking, and AES-128 HLS encryption right down to the chunk level."
        linkText="Explore security controls ↗"
      />
    </div>
  );
}

export default FeatureCardTilt;
