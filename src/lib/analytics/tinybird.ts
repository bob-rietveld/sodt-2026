import crypto from "crypto";
import { SearchEvent, SearchSource, WebEvent } from "./types";

const DATASOURCE = "events";
const WEB_EVENTS_DATASOURCE = "web_events";

export function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function logSearchEvent(params: {
  eventName: "search_query" | "chat_query";
  query: string;
  sessionId?: string;
  responseTimeMs?: number;
  answer?: string;
  sources?: SearchSource[];
  resultCount: number;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  // Read env vars at runtime (not module load time) for Render/serverless compatibility
  const tinybirdUrl = process.env.TINYBIRD_API_URL || "https://api.europe-west2.gcp.tinybird.co";
  const tinybirdToken = process.env.TINYBIRD_INGEST_TOKEN;

  console.log("[Tinybird] logSearchEvent called:", {
    eventName: params.eventName,
    query: params.query.slice(0, 50),
    hasToken: !!tinybirdToken,
    url: tinybirdUrl,
  });

  // Skip if Tinybird not configured (dev environment without local instance)
  if (!tinybirdToken) {
    console.warn("[Tinybird] TINYBIRD_INGEST_TOKEN not configured, skipping analytics");
    return;
  }

  // Format timestamp as space-separated DateTime64(3) for Tinybird (YYYY-MM-DD HH:MM:SS.SSS)
  // ClickHouse DateTime64(3) accepts both ISO 8601 and space-separated formats
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").replace("Z", "");

  const event: SearchEvent = {
    event_id: crypto.randomUUID(),
    event_name: params.eventName,
    query: params.query,
    session_id: params.sessionId || null,
    timestamp: timestamp,
    response_time_ms: params.responseTimeMs ?? null,
    answer: params.answer?.slice(0, 2000) ?? null,
    sources: JSON.stringify(params.sources || []),
    result_count: params.resultCount,
    user_agent: params.userAgent || null,
    ip_hash: hashIP(params.ip || null),
  };

  try {
    const url = `${tinybirdUrl}/v0/events?name=${DATASOURCE}&token=${tinybirdToken}`;
    console.log("[Tinybird] Sending event to:", url.replace(/token=[^&]+/, "token=***"));

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
      const error = await response.text();
      console.error("[Tinybird] Ingestion error:", response.status, error);
    } else {
      console.log("[Tinybird] Event sent successfully:", event.event_id);
    }
  } catch (error) {
    // Fire and forget - don't throw, just log
    console.error("[Tinybird] Ingestion failed:", error);
  }
}

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

  console.log("[Tinybird] logWebEvent called:", {
    eventType: params.eventType,
    pageUrl: params.pageUrl,
    hasToken: !!tinybirdToken,
    url: tinybirdUrl,
  });

  // Skip if Tinybird not configured (dev environment without local instance)
  if (!tinybirdToken) {
    console.warn("[Tinybird] TINYBIRD_INGEST_TOKEN not configured, skipping web analytics");
    return;
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
    console.log("[Tinybird] Sending web event to:", url.replace(/token=[^&]+/, "token=***"));

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
      const error = await response.text();
      console.error("[Tinybird] Web event ingestion error:", response.status, error);
    } else {
      console.log("[Tinybird] Web event sent successfully:", event.event_type, event.page_url);
    }
  } catch (error) {
    // Fire and forget - don't throw, just log
    console.error("[Tinybird] Web event ingestion failed:", error);
  }
}
