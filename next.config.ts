import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static generation for pages using external services
  // that aren't available during build time
  output: "standalone",
};

export default nextConfig;
