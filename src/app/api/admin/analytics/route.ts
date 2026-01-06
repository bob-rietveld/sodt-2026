import { NextRequest, NextResponse } from "next/server";

const TINYBIRD_URL =
  process.env.TINYBIRD_API_URL || "https://api.tinybird.co";
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
  params: Record<string, string | number> = {}
): Promise<T[]> {
  if (!TINYBIRD_TOKEN) {
    console.warn("TINYBIRD_ANALYTICS_API_KEY not configured");
    return [];
  }

  const searchParams = new URLSearchParams();
  searchParams.set("token", TINYBIRD_TOKEN);
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const url = `${TINYBIRD_URL}/v0/pipes/${pipeName}.json?${searchParams}`;

  const response = await fetch(url, {
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Tinybird query failed for ${pipeName}:`, response.status, error);
    throw new Error(`Tinybird query failed: ${response.status}`);
  }

  const json: TinybirdResponse<T> = await response.json();
  return json.data;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pipe = searchParams.get("pipe");
  const daysBack = searchParams.get("days_back") || "30";
  const limit = searchParams.get("limit") || "50";

  if (!pipe) {
    return NextResponse.json({ error: "Missing pipe parameter" }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid pipe name" }, { status: 400 });
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

    const data = await queryPipe(pipe, params);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
