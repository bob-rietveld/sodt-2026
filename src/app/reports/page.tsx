"use client";

import dynamic from "next/dynamic";

const ReportsContent = dynamic(() => import("./reports-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-foreground/50">Loading...</div>
    </div>
  ),
});

export default function ReportsPage() {
  return <ReportsContent />;
}
