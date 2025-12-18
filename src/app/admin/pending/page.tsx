"use client";

import dynamic from "next/dynamic";

const PendingContent = dynamic(() => import("./pending-content"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-foreground/50">Loading...</div>
    </div>
  ),
});

export default function AdminPendingPage() {
  return <PendingContent />;
}
