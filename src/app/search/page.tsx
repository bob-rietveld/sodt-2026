"use client";

import dynamic from "next/dynamic";

const SearchContent = dynamic(() => import("./search-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-foreground/50">Loading...</div>
    </div>
  ),
});

export default function SearchPage() {
  return <SearchContent />;
}
