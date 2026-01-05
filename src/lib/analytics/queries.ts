import type {
  AnalyticsSummary,
  RecentSearch,
  PopularSearchTerm,
  PopularSource,
  NoResultSearch,
} from "./types";

const TINYBIRD_URL =
  process.env.NEXT_PUBLIC_TINYBIRD_API_URL || "https://api.tinybird.co";
const TINYBIRD_TOKEN = process.env.NEXT_PUBLIC_TINYBIRD_READ_TOKEN;

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
    console.warn("NEXT_PUBLIC_TINYBIRD_READ_TOKEN not configured");
    return [];
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const url = `${TINYBIRD_URL}/v0/pipes/${pipeName}.json?${searchParams}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TINYBIRD_TOKEN}`,
    },
    // Cache for 30 seconds to avoid hammering the API
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

export async function getAnalyticsSummary(
  daysBack: number = 30
): Promise<AnalyticsSummary> {
  try {
    const [summaryData, searchesByDayData] = await Promise.all([
      queryPipe<{
        totalSearches: number;
        agentSearches: number;
        chatSearches: number;
        avgResponseTime: number;
        avgResultCount: number;
        noResultSearches: number;
      }>("analytics_summary", { days_back: daysBack }),
      queryPipe<{ date: string; count: number }>("searches_by_day", {
        days_back: daysBack,
      }),
    ]);

    const summary = summaryData[0] || {
      totalSearches: 0,
      agentSearches: 0,
      chatSearches: 0,
      avgResponseTime: 0,
      avgResultCount: 0,
      noResultSearches: 0,
    };

    return {
      ...summary,
      searchesByDay: Object.fromEntries(
        searchesByDayData.map((d) => [d.date, d.count])
      ),
    };
  } catch (error) {
    console.error("Failed to fetch analytics summary:", error);
    return {
      totalSearches: 0,
      agentSearches: 0,
      chatSearches: 0,
      avgResponseTime: 0,
      avgResultCount: 0,
      noResultSearches: 0,
      searchesByDay: {},
    };
  }
}

export async function getRecentSearches(
  limit: number = 50
): Promise<RecentSearch[]> {
  try {
    return await queryPipe<RecentSearch>("recent_searches", { limit });
  } catch (error) {
    console.error("Failed to fetch recent searches:", error);
    return [];
  }
}

export async function getPopularSearchTerms(
  limit: number = 20,
  daysBack: number = 30
): Promise<PopularSearchTerm[]> {
  try {
    return await queryPipe<PopularSearchTerm>("popular_searches", {
      limit,
      days_back: daysBack,
    });
  } catch (error) {
    console.error("Failed to fetch popular search terms:", error);
    return [];
  }
}

export async function getPopularSources(
  limit: number = 20,
  daysBack: number = 30
): Promise<PopularSource[]> {
  try {
    return await queryPipe<PopularSource>("popular_sources", {
      limit,
      days_back: daysBack,
    });
  } catch (error) {
    console.error("Failed to fetch popular sources:", error);
    return [];
  }
}

export async function getNoResultSearches(
  limit: number = 20
): Promise<NoResultSearch[]> {
  try {
    return await queryPipe<NoResultSearch>("no_result_searches", { limit });
  } catch (error) {
    console.error("Failed to fetch no result searches:", error);
    return [];
  }
}
