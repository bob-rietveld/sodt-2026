"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/client";

/**
 * Automatically tracks page views with client-side data
 * Add this component to your root layout
 * Note: We only use usePathname (which doesn't need Suspense)
 * The full URL with search params is captured client-side
 */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Track page view when route changes
    if (typeof window === "undefined") return;

    const pageTitle = document.title;
    const loadTime = performance.timing
      ? performance.timing.loadEventEnd - performance.timing.navigationStart
      : undefined;

    trackPageView({
      pageTitle,
      loadTime,
    });
  }, [pathname]);

  return null; // This component doesn't render anything
}

