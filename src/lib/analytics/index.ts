export { logSearchEvent, hashIP } from "./tinybird";
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
  AnalyticsSummary,
  RecentSearch,
  PopularSearchTerm,
  PopularSource,
  NoResultSearch,
} from "./types";
