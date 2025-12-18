"use client";

import { UserButton as ClerkUserButton } from "@clerk/nextjs";

export function UserButton({ afterSignOutUrl }: { afterSignOutUrl?: string }) {
  return <ClerkUserButton afterSignOutUrl={afterSignOutUrl} />;
}
