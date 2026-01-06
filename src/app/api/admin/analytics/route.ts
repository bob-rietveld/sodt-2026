import { NextRequest, NextResponse } from "next/server";

const TINYBIRD_URL =
  process.env.TINYBIRD_API_URL || "https://api.europe-west2.gcp.tinybird.co";
const TINYBIRD_TOKEN = process.env.TINYBIRD_ANALYTICS_API_KEY;

interface TinybirdResponse<T> {
  data: T[];
  meta: Array<{ name: string; type: string }>;
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

async function queryPipe<T>(
  pipeName: string,
  params: Record<string, string | number> = {},
  token: string
): Promise<T[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("token", token);
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const url = `${TINYBIRD_URL}/v0/pipes/${pipeName}.json?${searchParams}`;

  console.log(`[Tinybird] Querying pipe: ${pipeName}`, {
    url: url.replace(/token=[^&]+/, "token=***"),
    params,
    hasToken: !!token,
  });

  const response = await fetch(url, {
    next: { revalidate: 30 },
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Tinybird] Query failed for ${pipeName}:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url: url.replace(/token=[^&]+/, "token=***"),
    });
    throw new Error(`Tinybird query failed: ${response.status} - ${errorText}`);
  }

  const json: TinybirdResponse<T> = await response.json();
  return json.data;
}

export async function GET(request: NextRequest) {
  // Add CORS headers for browser requests
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS for CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const searchParams = request.nextUrl.searchParams;
  const pipe = searchParams.get("pipe");
  const daysBack = searchParams.get("days_back") || "30";
  const limit = searchParams.get("limit") || "50";

  if (!pipe) {
    return NextResponse.json({ error: "Missing pipe parameter" }, { status: 400, headers });
  }

  // Validate pipe names to prevent arbitrary pipe access
  const allowedPipes = [
    "analytics_summary",
    "searches_by_day",
    "recent_searches",
    "popular_searches",
    "popular_sources",
    "no_result_searches",
  ];

  if (!allowedPipes.includes(pipe)) {
    return NextResponse.json({ error: "Invalid pipe name" }, { status: 400, headers });
  }

  // Check if token is configured
  if (!TINYBIRD_TOKEN) {
    console.error("[Analytics API] TINYBIRD_ANALYTICS_API_KEY not configured");
    return NextResponse.json(
      { error: "Analytics API key not configured" },
      { status: 500, headers }
    );
  }

  try {
    const params: Record<string, string | number> = {};

    if (pipe === "analytics_summary" || pipe === "searches_by_day" ||
        pipe === "popular_searches" || pipe === "popular_sources") {
      params.days_back = parseInt(daysBack, 10);
    }

    if (pipe === "recent_searches" || pipe === "popular_searches" ||
        pipe === "popular_sources" || pipe === "no_result_searches") {
      params.limit = parseInt(limit, 10);
    }

    const data = await queryPipe(pipe, params, TINYBIRD_TOKEN);
    return NextResponse.json({ data }, { headers });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    
    // Return more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const statusCode = errorMessage.includes("403") ? 403 : 
                       errorMessage.includes("401") ? 401 : 500;
    
    return NextResponse.json(
      { 
        error: "Failed to fetch analytics data",
        details: errorMessage,
        pipe,
      },
      { status: statusCode, headers }
    );
  }
}
