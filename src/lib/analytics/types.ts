export interface SearchEvent {
  event_id: string;
  event_name: "search_query" | "chat_query";
  query: string;
  session_id: string | null;
  timestamp: string; // ISO 8601
  response_time_ms: number | null;
  answer: string | null;
  sources: string; // JSON stringified array
  result_count: number;
  user_agent: string | null;
  ip_hash: string | null;
}

export interface SearchSource {
  convexId?: string;
  title?: string;
  filename?: string;
  pageNumber?: number;
}

export interface AnalyticsSummary {
  totalSearches: number;
  agentSearches: number;
  chatSearches: number;
  avgResponseTime: number;
  avgResultCount: number;
  noResultSearches: number;
  searchesByDay: Record<string, number>;
}

export interface RecentSearch {
  _id: string;
  query: string;
  searchType: string;
  resultCount: number;
  responseTimeMs: number | null;
  timestamp: number;
}

export interface PopularSearchTerm {
  query: string;
  count: number;
  avgResults: number;
}

export interface PopularSource {
  convexId: string;
  title: string;
  filename: string;
  count: number;
}

export interface NoResultSearch {
  _id: string;
  query: string;
  timestamp: number;
}

export interface WebEvent {
  timestamp: string; // DateTime format: YYYY-MM-DD HH:MM:SS
  session_id: string;
  event_type: string; // "page_view", "click", "scroll", etc.
  page_url: string;
  page_title: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null; // "desktop", "mobile", "tablet"
  browser: string | null;
  os: string | null;
  screen_width: number | null;
  screen_height: number | null;
  load_time: number | null; // milliseconds
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  custom_data: string | null; // JSON stringified object
}
