import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static generation for pages using external services
  // that aren't available during build time
  output: "standalone",

  // Configure Turbopack (Next.js 16 default bundler)
  turbopack: {},

  // Externalize problematic server-side packages
  serverExternalPackages: [
    "pdf-to-img",
    "pdf-parse",
    "@napi-rs/canvas",
    "pdfjs-dist",
    "unpdf",
  ],
};

export default nextConfig;
