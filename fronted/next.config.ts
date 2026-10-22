import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support isolated local preview sessions without changing production origins.
  allowedDevOrigins: ["127.0.0.1"],
  reactCompiler: true,
};

export default nextConfig;
