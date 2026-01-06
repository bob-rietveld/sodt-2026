import { NextRequest, NextResponse } from "next/server";
import { logWebEvent } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      eventType,
      pageUrl,
      pageTitle,
      referrer,
      deviceType,
      screenWidth,
      screenHeight,
      loadTime,
      utmSource,
      utmMedium,
      utmCampaign,
      customData,
    } = body;

    // Validate required fields
    if (!sessionId || !eventType || !pageUrl) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, eventType, pageUrl" },
        { status: 400 }
      );
    }

    // Get request headers for user context
    const userAgent = request.headers.get("user-agent") || undefined;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;

    // Extract browser/OS from user agent (simplified - you might want to use a library like ua-parser-js)
    let browser: string | null = null;
    let os: string | null = null;
    if (userAgent) {
      if (userAgent.includes("Chrome")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari")) browser = "Safari";
      else if (userAgent.includes("Edge")) browser = "Edge";

      if (userAgent.includes("Windows")) os = "Windows";
      else if (userAgent.includes("Mac")) os = "macOS";
      else if (userAgent.includes("Linux")) os = "Linux";
      else if (userAgent.includes("Android")) os = "Android";
      else if (userAgent.includes("iOS")) os = "iOS";
    }

    // Determine device type from screen width if not provided
    const detectedDeviceType =
      deviceType ||
      (screenWidth
        ? screenWidth < 768
          ? "mobile"
          : screenWidth < 1024
            ? "tablet"
            : "desktop"
        : null);

    // Log to Tinybird (fire and forget)
    logWebEvent({
      sessionId,
      eventType,
      pageUrl,
      pageTitle: pageTitle || null,
      referrer: referrer || null,
      userAgent,
      ip,
      deviceType: detectedDeviceType,
      browser,
      os,
      screenWidth: screenWidth || null,
      screenHeight: screenHeight || null,
      loadTime: loadTime || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      customData: customData || null,
    }).catch((err) => console.error("Failed to log web event:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics track error:", error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    );
  }
}

