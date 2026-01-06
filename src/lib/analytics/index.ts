export { logSearchEvent, logWebEvent, hashIP } from "./tinybird";
export {
  getAnalyticsSummary,
  getRecentSearches,
  getPopularSearchTerms,
  getPopularSources,
  getNoResultSearches,
} from "./queries";
export type {
  SearchEvent,
  SearchSource,
  WebEvent,
  AnalyticsSummary,
  RecentSearch,
  PopularSearchTerm,
  PopularSource,
  NoResultSearch,
} from "./types";
