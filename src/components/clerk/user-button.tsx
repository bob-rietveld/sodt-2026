"use client";

import { UserButton as ClerkUserButton } from "@clerk/nextjs";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function UserButton({ afterSignOutUrl }: { afterSignOutUrl?: string }) {
  if (!publishableKey) {
    // Render placeholder when Clerk is not configured
    return (
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
        A
      </div>
    );
  }

  return <ClerkUserButton afterSignOutUrl={afterSignOutUrl} />;
}
