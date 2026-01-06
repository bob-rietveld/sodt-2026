"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics/client";

/**
 * Automatically tracks page views with client-side data
 * Add this component to your root layout
 */
export function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view when route changes
    const pageTitle = document.title;
    const loadTime = performance.timing
      ? performance.timing.loadEventEnd - performance.timing.navigationStart
      : undefined;

    trackPageView({
      pageTitle,
      loadTime,
    });
  }, [pathname, searchParams]);

  return null; // This component doesn't render anything
}

