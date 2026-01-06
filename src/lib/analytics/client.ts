/**
 * Client-side analytics helper
 * Complements server-side tracking with client-specific data
 */

export async function trackPageView(additionalData?: {
  pageTitle?: string;
  loadTime?: number;
  screenWidth?: number;
  screenHeight?: number;
  deviceType?: string;
  browser?: string;
  os?: string;
}) {
  try {
    // Get session ID from cookie (set by middleware)
    const sessionId = getCookie("tb_session_id") || generateSessionId();
    
    // Get current page info
    const pageUrl = window.location.pathname + window.location.search;
    const pageTitle = additionalData?.pageTitle || document.title;
    const referrer = document.referrer || undefined;

    // Get screen dimensions
    const screenWidth = additionalData?.screenWidth || window.screen.width;
    const screenHeight = additionalData?.screenHeight || window.screen.height;

    // Get load time if available
    const loadTime = additionalData?.loadTime || 
      (performance.timing ? 
        performance.timing.loadEventEnd - performance.timing.navigationStart : 
        undefined);

    // Detect device type
    const deviceType = additionalData?.deviceType || 
      (screenWidth < 768 ? "mobile" : screenWidth < 1024 ? "tablet" : "desktop");

    // Send to API (fire and forget)
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        eventType: "page_view",
        pageUrl,
        pageTitle,
        referrer,
        screenWidth,
        screenHeight,
        loadTime,
        deviceType,
        browser: additionalData?.browser,
        os: additionalData?.os,
      }),
    }).catch(() => {
      // Silently fail
    });
  } catch (error) {
    // Silently fail - analytics should never break the app
    if (process.env.NODE_ENV === "development") {
      console.error("[Analytics] Failed to track page view:", error);
    }
  }
}

export async function trackEvent(
  eventType: string,
  customData?: Record<string, unknown>
) {
  try {
    const sessionId = getCookie("tb_session_id") || generateSessionId();
    const pageUrl = window.location.pathname + window.location.search;
    const pageTitle = document.title;

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        eventType,
        pageUrl,
        pageTitle,
        customData,
      }),
    }).catch(() => {
      // Silently fail
    });
  } catch (error) {
    // Silently fail
  }
}

// Helper functions
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

