"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAnalyticsSummary,
  getRecentSearches,
  getPopularSearchTerms,
  getPopularSources,
  getNoResultSearches,
  type AnalyticsSummary,
  type RecentSearch,
  type PopularSearchTerm,
  type PopularSource,
  type NoResultSearch,
} from "@/lib/analytics";

export default function AnalyticsContent() {
  const [daysBack, setDaysBack] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [popularTerms, setPopularTerms] = useState<PopularSearchTerm[]>([]);
  const [popularSources, setPopularSources] = useState<PopularSource[]>([]);
  const [noResultSearches, setNoResultSearches] = useState<NoResultSearch[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryData, recent, terms, sources, noResults] = await Promise.all([
        getAnalyticsSummary(daysBack),
        getRecentSearches(20),
        getPopularSearchTerms(10, daysBack),
        getPopularSources(10, daysBack),
        getNoResultSearches(10),
      ]);
      setSummary(summaryData);
      setRecentSearches(recent);
      setPopularTerms(terms);
      setPopularSources(sources);
      setNoResultSearches(noResults);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate max value for chart scaling
  const chartData = summary?.searchesByDay || {};
  const chartDates = Object.keys(chartData).sort();
  const maxCount = Math.max(...Object.values(chartData), 1);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Search Analytics</h1>
          <p className="text-foreground/60 mt-1">
            Monitor search queries and usage patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground/60">Time Range:</label>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-foreground/20 bg-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-foreground/50">Loading analytics...</div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <div className="text-4xl font-semibold text-primary mb-2">
                {summary?.totalSearches ?? 0}
              </div>
              <div className="font-medium text-foreground/80">Total Searches</div>
              <div className="text-sm text-foreground/50 mt-1">Last {daysBack} days</div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <div className="text-4xl font-semibold text-info mb-2">
                {summary?.avgResponseTime ?? 0}ms
              </div>
              <div className="font-medium text-foreground/80">Avg Response Time</div>
              <div className="text-sm text-foreground/50 mt-1">Query to answer</div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <div className="text-4xl font-semibold text-success mb-2">
                {summary?.avgResultCount ?? 0}
              </div>
              <div className="font-medium text-foreground/80">Avg Results</div>
              <div className="text-sm text-foreground/50 mt-1">Per search query</div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <div className="text-4xl font-semibold text-warning mb-2">
                {summary?.noResultSearches ?? 0}
              </div>
              <div className="font-medium text-foreground/80">No Results</div>
              <div className="text-sm text-foreground/50 mt-1">Searches with 0 hits</div>
            </div>
          </div>

          {/* Search Type Breakdown */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <h2 className="text-lg font-semibold mb-4">Search Types</h2>
              <div className="flex items-center gap-8">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Agent Search</span>
                    <span className="text-sm text-foreground/60">{summary?.agentSearches ?? 0}</span>
                  </div>
                  <div className="h-3 bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${(summary?.totalSearches ?? 0) > 0 ? ((summary?.agentSearches ?? 0) / (summary?.totalSearches ?? 1)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Chat Search</span>
                    <span className="text-sm text-foreground/60">{summary?.chatSearches ?? 0}</span>
                  </div>
                  <div className="h-3 bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full"
                      style={{
                        width: `${(summary?.totalSearches ?? 0) > 0 ? ((summary?.chatSearches ?? 0) / (summary?.totalSearches ?? 1)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Searches Chart */}
            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <h2 className="text-lg font-semibold mb-4">Searches Over Time</h2>
              {chartDates.length > 0 ? (
                <div className="flex items-end gap-1 h-32">
                  {chartDates.slice(-14).map((date) => (
                    <div key={date} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-primary/80 rounded-t"
                        style={{
                          height: `${(chartData[date] / maxCount) * 100}%`,
                          minHeight: chartData[date] > 0 ? "4px" : "0",
                        }}
                        title={`${date}: ${chartData[date]} searches`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-foreground/50 text-sm">
                  No data for this period
                </div>
              )}
              {chartDates.length > 0 && (
                <div className="flex justify-between mt-2 text-xs text-foreground/50">
                  <span>{chartDates.slice(-14)[0]?.slice(5)}</span>
                  <span>{chartDates.slice(-1)[0]?.slice(5)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Popular Search Terms and Sources */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <h2 className="text-lg font-semibold mb-4">Popular Search Terms</h2>
              {popularTerms.length > 0 ? (
                <div className="space-y-3">
                  {popularTerms.map((term, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground/50 w-6">
                          {index + 1}.
                        </span>
                        <span className="text-sm truncate max-w-[200px]" title={term.query}>
                          {term.query}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-foreground/50">
                          {term.avgResults} avg results
                        </span>
                        <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                          {term.count}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-foreground/50 text-sm">
                  No search data yet
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-foreground/10">
              <h2 className="text-lg font-semibold mb-4">Frequently Cited Sources</h2>
              {popularSources.length > 0 ? (
                <div className="space-y-3">
                  {popularSources.map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground/50 w-6">
                          {index + 1}.
                        </span>
                        <span className="text-sm truncate max-w-[200px]" title={source.title}>
                          {source.title}
                        </span>
                      </div>
                      <span className="text-sm font-medium bg-success/10 text-success px-2 py-1 rounded">
                        {source.count}x
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-foreground/50 text-sm">
                  No source data yet
                </div>
              )}
            </div>
          </div>

          {/* No Result Searches */}
          <div className="bg-white p-6 rounded-xl border border-foreground/10 mb-8">
            <h2 className="text-lg font-semibold mb-4">Searches with No Results</h2>
            <p className="text-sm text-foreground/60 mb-4">
              These queries returned no results - consider adding relevant documents
            </p>
            {noResultSearches.length > 0 ? (
              <div className="space-y-2">
                {noResultSearches.map((search) => (
                  <div
                    key={search._id}
                    className="flex items-center justify-between py-2 border-b border-foreground/5 last:border-0"
                  >
                    <span className="text-sm">{search.query}</span>
                    <span className="text-xs text-foreground/50">
                      {formatDate(search.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-foreground/50 text-sm">
                All searches returned results
              </div>
            )}
          </div>

          {/* Recent Searches */}
          <div className="bg-white p-6 rounded-xl border border-foreground/10">
            <h2 className="text-lg font-semibold mb-4">Recent Searches</h2>
            {recentSearches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-foreground/60 border-b border-foreground/10">
                      <th className="pb-3 font-medium">Query</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Results</th>
                      <th className="pb-3 font-medium">Response Time</th>
                      <th className="pb-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSearches.map((search) => (
                      <tr key={search._id} className="border-b border-foreground/5 last:border-0">
                        <td className="py-3 text-sm max-w-[300px] truncate" title={search.query}>
                          {search.query}
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              search.searchType === "search_query"
                                ? "bg-primary/10 text-primary"
                                : "bg-info/10 text-info"
                            }`}
                          >
                            {search.searchType === "search_query" ? "agent" : "chat"}
                          </span>
                        </td>
                        <td className="py-3 text-sm">
                          <span
                            className={`${
                              search.resultCount === 0 ? "text-warning" : "text-foreground"
                            }`}
                          >
                            {search.resultCount}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-foreground/60">
                          {search.responseTimeMs ? `${search.responseTimeMs}ms` : "-"}
                        </td>
                        <td className="py-3 text-sm text-foreground/60">
                          {formatDate(search.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-foreground/50">
                No search data yet. Searches from public users will appear here.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
