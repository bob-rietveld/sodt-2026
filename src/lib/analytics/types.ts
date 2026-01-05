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
