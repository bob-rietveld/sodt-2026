"use client";

import { useState, useEffect } from "react";

interface DataSource {
  name: string;
  description: string;
  category: string;
  parameters?: Array<{
    name: string;
    type: string;
    default?: string | number;
    description?: string;
  }>;
  exampleQueries: string[];
}

interface DataCatalogProps {
  onSelectExample?: (query: string) => void;
}

export function DataCatalog({ onSelectExample }: DataCatalogProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Fetch catalog data
  const fetchCatalog = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
        // Clear cache first
        await fetch("/api/analytics/catalog/refresh", { method: "POST" });
      } else {
        setIsLoading(true);
      }

      setError(null);

      const response = await fetch("/api/analytics/catalog");
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDataSources(data.dataSources || []);
      setLastFetched(data.fetchedAt || Date.now());
    } catch (err) {
      console.error("Failed to load catalog:", err);
      setError(err instanceof Error ? err.message : "Failed to load catalog");
      setDataSources([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load on mount
  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleRefresh = () => {
    fetchCatalog(true);
  };

  const categories = [
    "all",
    ...Array.from(new Set(dataSources.map((ds: DataSource) => ds.category))),
  ];

  const filteredSources =
    selectedCategory === "all"
      ? dataSources
      : dataSources.filter((ds: DataSource) => ds.category === selectedCategory);

  // Format last fetched time
  const formatLastFetched = () => {
    if (!lastFetched) return "";
    const now = Date.now();
    const diff = now - lastFetched;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    return new Date(lastFetched).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Available Data Sources</h2>
          <p className="text-foreground/60">
            Explore what analytics data you can query and see example questions
          </p>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground/20 rounded-lg hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh catalog from Tinybird"
        >
          <svg
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Last Updated */}
      {lastFetched && !isLoading && (
        <div className="text-xs text-foreground/40">
          Last updated: {formatLastFetched()}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-foreground/60">Loading data sources...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 mb-1">
                Failed to load catalog
              </h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => fetchCatalog()}
                className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {!isLoading && !error && (
        <>
          {/* Empty State */}
          {dataSources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="h-16 w-16 text-foreground/20 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="text-lg font-medium text-foreground/60 mb-2">
                No data sources found
              </h3>
              <p className="text-sm text-foreground/40 mb-4">
                Deploy some Tinybird pipes with TYPE endpoint to see them here
              </p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Refresh Catalog
              </button>
            </div>
          )}

          {/* Category Filter */}
          {dataSources.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? "bg-primary text-white"
                        : "bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    {category === "all" ? "All" : category}
                  </button>
                ))}
              </div>

              {/* Data Sources */}
              <div className="space-y-3">
                {filteredSources.map((source: DataSource) => (
          <div
            key={source.name}
            className="border border-foreground/10 rounded-lg overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedSource(expandedSource === source.name ? null : source.name)
              }
              className="w-full px-4 py-3 bg-foreground/5 hover:bg-foreground/10 transition-colors text-left flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{source.name}</h3>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                    {source.category}
                  </span>
                </div>
                <p className="text-sm text-foreground/60 mt-1">{source.description}</p>
              </div>
              <svg
                className={`w-5 h-5 text-foreground/40 transition-transform ${
                  expandedSource === source.name ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expandedSource === source.name && (
              <div className="px-4 py-3 space-y-4 bg-white">
                {/* Parameters */}
                {source.parameters && source.parameters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Parameters:</h4>
                    <div className="space-y-2">
                      {source.parameters.map((param) => (
                        <div
                          key={param.name}
                          className="text-sm bg-foreground/5 rounded px-3 py-2"
                        >
                          <div className="font-mono text-primary">
                            {param.name}
                            <span className="text-foreground/40 ml-2">({param.type})</span>
                            {param.default !== undefined && (
                              <span className="text-foreground/60 ml-2">
                                = {param.default}
                              </span>
                            )}
                          </div>
                          {param.description && (
                            <div className="text-foreground/60 mt-1">
                              {param.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Example Queries */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Try asking:</h4>
                  <div className="space-y-2">
                    {source.exampleQueries.map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectExample?.(query)}
                        className="w-full text-left text-sm px-3 py-2 bg-foreground/5 hover:bg-foreground/10 rounded transition-colors flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4 text-primary flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
                ))}
              </div>

              {/* Help Text */}
              <div className="text-sm text-foreground/60 bg-foreground/5 rounded-lg p-4">
                <strong>Tip:</strong> Click on any example question to try it in the chat, or
                ask your own questions in natural language. The AI will automatically select
                the right data source and parameters.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
