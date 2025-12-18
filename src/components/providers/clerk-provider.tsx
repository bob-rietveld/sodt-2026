"use client";

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    // During build or when key is not configured, render children without provider
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider publishableKey={publishableKey}>
      {children}
    </BaseClerkProvider>
  );
}
