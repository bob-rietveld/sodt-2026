import crypto from "crypto";
import { SearchEvent, SearchSource } from "./types";

const DATASOURCE = "events";

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
  const tinybirdUrl = process.env.TINYBIRD_API_URL || "https://api.tinybird.co";
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

  const event: SearchEvent = {
    event_id: crypto.randomUUID(),
    event_name: params.eventName,
    query: params.query,
    session_id: params.sessionId || null,
    timestamp: new Date().toISOString(),
    response_time_ms: params.responseTimeMs ?? null,
    answer: params.answer?.slice(0, 2000) ?? null,
    sources: JSON.stringify(params.sources || []),
    result_count: params.resultCount,
    user_agent: params.userAgent || null,
    ip_hash: hashIP(params.ip || null),
  };

  try {
    const url = `${tinybirdUrl}/v0/events?name=${DATASOURCE}`;
    console.log("[Tinybird] Sending event to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tinybirdToken}`,
      },
      body: JSON.stringify(event),
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
