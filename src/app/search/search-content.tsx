"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Header } from "@/components/ui/header";
import { ReportCard } from "@/components/reports/report-card";
import { ReportTable } from "@/components/reports/report-table";
import { ViewToggle, ViewMode } from "@/components/reports/view-toggle";
import { PDF } from "@/types";

interface SearchSource {
  content: string;
  title: string;
  filename: string;
  pageNumber: number;
  convexId: string;
}

interface SearchResponse {
  answer: string;
  sources: SearchSource[];
}

export default function SearchContent() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // Also show PDFs from Convex for basic search
  const convexResults = useQuery(api.pdfs.search, { query });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResponse(data);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <Header showAdmin={false} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8">Search Documents</h1>

        {/* Search Input */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ask a question about your documents..."
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-foreground/20 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm sm:text-base"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-danger/10 text-danger rounded-lg text-sm sm:text-base">
            {error}
          </div>
        )}

        {/* AI Answer */}
        {response?.answer && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-medium text-foreground/70 mb-3 sm:mb-4">
              AI Answer
            </h2>
            <div className="bg-white p-4 sm:p-6 rounded-xl border border-primary/20 shadow-sm">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                {response.answer}
              </p>
            </div>
          </div>
        )}

        {/* Sources */}
        {response?.sources && response.sources.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-medium text-foreground/70 mb-3 sm:mb-4">
              Sources ({response.sources.length})
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {response.sources.map((source, index) => (
                <div
                  key={index}
                  className="bg-white p-4 sm:p-6 rounded-xl border border-foreground/10 hover:border-primary/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-base sm:text-lg">{source.title || source.filename}</h3>
                    <span className="text-xs sm:text-sm text-foreground/50 bg-foreground/5 px-2 py-1 rounded self-start flex-shrink-0">
                      Page {source.pageNumber}
                    </span>
                  </div>
                  <p className="text-foreground/70 mb-3 line-clamp-4 text-sm sm:text-base">
                    {source.content}
                  </p>
                  <div className="flex items-center gap-4 text-xs sm:text-sm text-foreground/50">
                    <span className="truncate">{source.filename}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: Show Convex documents if no search performed */}
        {!response && !isSearching && (
          <div className="space-y-3 sm:space-y-4">
            {convexResults && convexResults.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-medium text-foreground/70">
                    Available Documents ({convexResults.length})
                  </h2>
                  <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                </div>
                {viewMode === "card" ? (
                  <div className="grid gap-4">
                    {convexResults.map((pdf: PDF) => (
                      <ReportCard key={pdf._id} report={pdf} />
                    ))}
                  </div>
                ) : (
                  <ReportTable reports={convexResults} />
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12 text-foreground/50 text-sm sm:text-base">
                Ask a question to search your documents with AI.
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {response && !response.answer && response.sources?.length === 0 && (
          <div className="text-center py-8 sm:py-12 text-foreground/50 text-sm sm:text-base">
            No results found. Try a different search term.
          </div>
        )}
      </main>
    </div>
  );
}
