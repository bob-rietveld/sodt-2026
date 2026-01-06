import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { logWebEvent } from "@/lib/analytics/tinybird-edge";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);

// Generate or get session ID from cookie
// Uses Web Crypto API for Edge Runtime compatibility
function getOrCreateSessionId(req: Request): string {
  const cookies = req.headers.get("cookie") || "";
  const sessionMatch = cookies.match(/tb_session_id=([^;]+)/);
  
  if (sessionMatch) {
    return sessionMatch[1];
  }
  
  // Generate new session ID using Web Crypto API (Edge Runtime compatible)
  // Generate a random UUID v4
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  
  // Convert to UUID string format
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export default clerkMiddleware(async (auth, req) => {
  // Handle authentication first
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Get or create session ID
  const cookies = req.headers.get("cookie") || "";
  let sessionId = getOrCreateSessionId(req);
  const hasSessionCookie = cookies.includes("tb_session_id=");

  // Track page views (fire and forget - don't block request)
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Skip tracking for:
  // - API routes
  // - Static files (already excluded by matcher)
  // - Next.js internals
  if (
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/favicon.ico"
  ) {
    const userAgent = req.headers.get("user-agent") || undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const referrer = req.headers.get("referer") || undefined;

    // Extract UTM parameters from URL
    const utmSource = url.searchParams.get("utm_source") || undefined;
    const utmMedium = url.searchParams.get("utm_medium") || undefined;
    const utmCampaign = url.searchParams.get("utm_campaign") || undefined;

    // Log page view (fire and forget - don't await)
    logWebEvent({
      sessionId,
      eventType: "page_view",
      pageUrl: url.pathname + url.search,
      pageTitle: null, // Will be enhanced by client-side
      referrer: referrer || undefined,
      userAgent,
      ip,
      utmSource,
      utmMedium,
      utmCampaign,
    }).catch(() => {
      // Silently fail - analytics should never break the app
    });
  }

  // Set session ID cookie if not present
  const response = NextResponse.next();
  if (!hasSessionCookie) {
    response.cookies.set("tb_session_id", sessionId, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
