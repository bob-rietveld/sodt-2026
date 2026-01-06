"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/client";

/**
 * Automatically tracks page views with client-side data
 * Only tracks top-level routes, not dynamic routes like /reports/[id]
 * Those are tracked via click events instead
 */
export function PageTracker() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    // Track page view when route changes (only for top-level routes)
    if (typeof window === "undefined") return;

    // Skip if pathname hasn't changed
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;

    // Define top-level routes to track
    const topLevelRoutes = [
      "/",
      "/reports",
      "/chat",
      "/search",
      "/about",
      "/upload",
      "/insights",
      "/contribute",
    ];

    // Only track top-level routes or admin routes
    // Skip dynamic routes like /reports/[id] - those are tracked via clicks
    const isTopLevelRoute =
      topLevelRoutes.includes(pathname) || pathname.startsWith("/admin");

    if (!isTopLevelRoute) return;

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

