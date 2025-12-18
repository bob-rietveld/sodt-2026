"use client";

import dynamic from "next/dynamic";

// Dynamically import the upload content with SSR disabled
// This prevents Convex hooks from running during pre-rendering
const UploadContent = dynamic(() => import("./upload-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-foreground/50">Loading...</div>
    </div>
  ),
});

export default function UploadPage() {
  return <UploadContent />;
}
