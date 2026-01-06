/**
 * Edge Runtime compatible Tinybird web events logging
 * This module doesn't import Node.js crypto, making it safe for Edge Runtime
 */

import { WebEvent } from "./types";

const WEB_EVENTS_DATASOURCE = "web_events";

export async function logWebEvent(params: {
  sessionId: string;
  eventType: string; // "page_view", "click", "scroll", etc.
  pageUrl: string;
  pageTitle?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  city?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  loadTime?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  customData?: Record<string, unknown> | null;
}): Promise<void> {
  // Read env vars at runtime (not module load time) for Render/serverless compatibility
  const tinybirdUrl = process.env.TINYBIRD_API_URL || "https://api.europe-west2.gcp.tinybird.co";
  const tinybirdToken = process.env.TINYBIRD_INGEST_TOKEN;

  // Skip if Tinybird not configured (dev environment without local instance)
  if (!tinybirdToken) {
    return; // Silently skip in Edge Runtime (don't log to avoid spam)
  }

  // Format timestamp as DateTime for Tinybird (YYYY-MM-DD HH:MM:SS)
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

  const event: WebEvent = {
    timestamp: timestamp,
    session_id: params.sessionId,
    event_type: params.eventType,
    page_url: params.pageUrl,
    page_title: params.pageTitle ?? null,
    referrer: params.referrer ?? null,
    user_agent: params.userAgent ?? null,
    ip_address: params.ip ?? null,
    country: params.country ?? null,
    city: params.city ?? null,
    device_type: params.deviceType ?? null,
    browser: params.browser ?? null,
    os: params.os ?? null,
    screen_width: params.screenWidth ?? null,
    screen_height: params.screenHeight ?? null,
    load_time: params.loadTime ?? null,
    utm_source: params.utmSource ?? null,
    utm_medium: params.utmMedium ?? null,
    utm_campaign: params.utmCampaign ?? null,
    custom_data: params.customData ? JSON.stringify(params.customData) : null,
  };

  try {
    const url = `${tinybirdUrl}/v0/events?name=${WEB_EVENTS_DATASOURCE}&token=${tinybirdToken}`;

    // Tinybird Events API expects NDJSON format (newline-delimited JSON)
    // Each event must be a single JSON object followed by a newline
    const ndjsonBody = JSON.stringify(event) + "\n";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
      },
      body: ndjsonBody,
    });

    if (!response.ok) {
      // Silently fail in Edge Runtime - don't log to avoid spam
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
  }
}

